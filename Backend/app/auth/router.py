"""
app/auth/router.py
==================
Shared authentication router registering all shared IAM endpoints.
Registered under the prefix `/api/auth`.
"""
import time
import re
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
    TokenError,
)
from app.core.iam_service import (
    get_user_by_email,
    get_user_by_id,
    get_organization_by_id,
    get_organizations_by_ids,
    update_user_last_login,
)
from app.core.token_store import (
    create_refresh_token_record,
    validate_refresh_token,
    revoke_token,
)
from app.core.audit import log_event
from app.auth.schemas import (
    LoginRequest,
    LoginResponse,
    LoginResponseData,
    UserData,
    OrgData,
    SelectOrgRequest,
    SelectOrgResponse,
    SelectOrgResponseData,
    RefreshRequest,
    RefreshResponse,
    RefreshResponseData,
    LogoutRequest,
    LogoutResponse,
    RegisterOrganizationRequest,
)

router = APIRouter(prefix="/api/auth", tags=["Shared Auth"])


def get_bearer_token(authorization: Optional[str] = Header(None)) -> str:
    """Helper dependency to extract JWT from Authorization header."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization Header",
        )
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization Header Format. Use 'Bearer <token>'",
        )
    return parts[1]


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, request: Request):
    """Authenticate credentials and return user context with access + refresh tokens."""
    # ip = request.client.host if request.client else None
    # user_agent = request.headers.get("user-agent")

    # user = await get_user_by_email(payload.email)
    # if not user:
    #     await log_event(
    #         event_type="login_fail",
    #         email=payload.email,
    #         ip=ip,
    #         user_agent=user_agent,
    #         meta={"reason": "user_not_found"},
    #     )
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="Invalid email or password",
    #     )

    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    print("Email:", payload.email)

    user = await get_user_by_email(payload.email)

    print("User Found:", user is not None)

    if user:
        print("Stored Hash:", user["passwordHash"])
        print("Password Entered:", payload.password)
        print("Password Match:", verify_password(payload.password, user["passwordHash"]))
    

    if not user:
        await log_event(
            event_type="login_fail",
            email=payload.email,
            ip=ip,
            user_agent=user_agent,
            meta={"reason": "user_not_found"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(payload.password, user["passwordHash"]):
        await log_event(
            event_type="login_fail",
            user_id=user["_id"],
            email=user["email"],
            ip=ip,
            user_agent=user_agent,
            meta={"reason": "incorrect_password"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    is_active = user.get("isActive", True)

    if not is_active:
        await log_event(
            event_type="login_fail",
            user_id=user["_id"],
            email=user["email"],
            ip=ip,
            user_agent=user_agent,
            meta={"reason": "user_account_inactive"},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    # Load organizations user belongs to
    org_ids = []
    if "companyIds" in user:
        org_ids.extend(user["companyIds"])
    if "organizations" in user:
        org_ids.extend(user["organizations"])
    if "orgs" in user:
        for o in user["orgs"]:
            if isinstance(o, dict) and "orgId" in o:
                org_ids.append(o["orgId"])
            elif isinstance(o, str):
                org_ids.append(o)

    # Deduplicate
    org_ids = list(set(str(oid) for oid in org_ids if oid))

    org_list = await get_organizations_by_ids(org_ids)
    active_orgs = [o for o in org_list if o.get("status") == "active"]



    # Issue initial unscoped access token
    access_claims = {
        "sub": user["_id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "permissions": user.get("permissions", []),
        "apps": user.get("apps", []),
    }
    access_token = create_access_token(access_claims)

    # Issue refresh token
    refresh_claims = {
        "sub": user["_id"],
    }
    refresh_token = create_refresh_token(refresh_claims)

    # Save refresh token in database (no org selected yet)
    expires_epoch = int(time.time()) + (7 * 24 * 60 * 60) # Default 7 days

    await create_refresh_token_record(
        token=refresh_token,
        user_id=user["_id"],
        org_id=None,
        expires_at_epoch=expires_epoch,
        user_agent=user_agent,
        ip=ip,
    )

    # Update last login timestamp
    await update_user_last_login(user["_id"])

    await log_event(
        event_type="login_success",
        user_id=user["_id"],
        email=user["email"],
        ip=ip,
        user_agent=user_agent,
    )

    response_orgs = [
        OrgData(
            id=str(o["_id"]),
            slug=o["slug"],
            name=o["name"],
            displayName=o.get("displayName") or o["name"],
            status=o.get("status", "active"),
        )
        for o in active_orgs
    ]

    return LoginResponse(
        success=True,
        data=LoginResponseData(
            token=access_token,
            refreshToken=refresh_token,
            user=UserData(
                 id=str(user["_id"]),
    email=user["email"],
    name=user["name"],
    role=user["role"],
    companyIds=user.get("companyIds", []),
    orgs=user.get("orgs", []),
    phone=user.get("phone", ""),
    isActive=user.get("isActive", True),
            ),
            organizations=response_orgs,
        ),
    )


@router.post("/switch-organization", response_model=SelectOrgResponse)
async def switch_organization(
    payload: SelectOrgRequest,
    request: Request,
    token: str = Depends(get_bearer_token),
):
    """Scope the session under the selected organization and return an org-scoped JWT."""
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    try:
        claims = decode_token(token)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )

    user_id = claims["sub"]
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Verify user belongs to organization
    org_id = payload.organizationId
    
    user_org_ids = []
    if "organizations" in user:
        user_org_ids.extend(user["organizations"])
    if "companyIds" in user:
        user_org_ids.extend(user["companyIds"])
    if "orgs" in user:
        for o in user["orgs"]:
            if isinstance(o, dict) and "orgId" in o:
                user_org_ids.append(o["orgId"])
            elif isinstance(o, str):
                user_org_ids.append(o)
                
    user_org_ids = [str(oid) for oid in user_org_ids if oid]

    if org_id not in user_org_ids:
        await log_event(
            event_type="access_denied",
            user_id=user["_id"],
            email=user["email"],
            org_id=org_id,
            ip=ip,
            user_agent=user_agent,
            meta={"reason": "unauthorized_org_switch"},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not have access to this organization",
        )


    org = await get_organization_by_id(org_id)
    if not org or org.get("status") != "active":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found or inactive",
        )

    # Fetch role permissions matrix from iam.roles collection
    db = await get_async_iam_db()
    user_role_ref = user.get("role") or user.get("roleId") or ""
    role_permissions = {}

    if user_role_ref:
        from bson import ObjectId
        role_conditions = [
            {"name": str(user_role_ref)},
            {"id": str(user_role_ref)}
        ]
        if len(str(user_role_ref)) == 24 and re.match(r"^[0-9a-fA-F]{24}$", str(user_role_ref)):
            try:
                role_conditions.append({"_id": ObjectId(user_role_ref)})
            except Exception:
                pass
        role_doc = await db["roles"].find_one({"$or": role_conditions})
        if role_doc:
            role_permissions = role_doc.get("permissions") or role_doc.get("matrix") or {}

    # Issue org-scoped access token with dynamic role permissions
    org_access_claims = {
        "sub": user["_id"],
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role") or "User",
        "orgId": org["_id"],
        "orgDbName": org["dbName"],
        "orgName": org.get("displayName") or org["name"],
        "permissions": role_permissions,
        "apps": user.get("apps", []),
    }
    org_access_token = create_access_token(org_access_claims)

    # Issue new refresh token linked to org
    org_refresh_claims = {
        "sub": user["_id"],
        "orgId": org["_id"],
    }
    org_refresh_token = create_refresh_token(org_refresh_claims)

    expires_epoch = int(time.time()) + (7 * 24 * 60 * 60)

    await create_refresh_token_record(
        token=org_refresh_token,
        user_id=user["_id"],
        org_id=org["_id"],
        expires_at_epoch=expires_epoch,
        user_agent=user_agent,
        ip=ip,
    )

    await log_event(
        event_type="org_switch",
        user_id=user["_id"],
        email=user["email"],
        org_id=org["_id"],
        ip=ip,
        user_agent=user_agent,
    )

    return SelectOrgResponse(
        success=True,
        data=SelectOrgResponseData(
            token=org_access_token,
            refreshToken=org_refresh_token,
            organization=OrgData(
                id=str(org["_id"]),
                slug=org["slug"],
                name=org["name"],
                displayName=org.get("displayName") or org["name"],
                status=org.get("status", "active"),
            ),
        ),
    )


@router.post("/refresh-token", response_model=RefreshResponse)
async def refresh_token(payload: RefreshRequest, request: Request):
    """Validate refresh token and issue a new access token (inheriting organization scope)."""
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # 1. Validate in DB
    record = await validate_refresh_token(payload.refreshToken)
    if not record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or revoked refresh token",
        )

    # 2. Decode claims
    try:
        claims = decode_token(payload.refreshToken)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )

    user_id = claims["sub"]
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Build access claims
    access_claims = {
        "sub": user["_id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "permissions": user.get("permissions", []),
        "apps": user.get("apps", []),
    }

    # If previous session was org-scoped, preserve it
    org_id = record.get("orgId")
    if org_id:
        org = await get_organization_by_id(org_id)
        if org and org.get("status") == "active":
            access_claims.update({
                "orgId": org["_id"],
                "orgDbName": org["dbName"],
                "orgName": org.get("displayName") or org["name"],
            })

    new_access_token = create_access_token(access_claims)

    await log_event(
        event_type="token_refresh",
        user_id=user["_id"],
        email=user["email"],
        org_id=org_id,
        ip=ip,
        user_agent=user_agent,
    )

    return RefreshResponse(
        success=True,
        data=RefreshResponseData(token=new_access_token),
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(payload: LogoutRequest, request: Request, token: str = Depends(get_bearer_token)):
    """Revoke refresh token and end session."""
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Decode to find identity for audit logging
    user_id = None
    email = None
    try:
        claims = decode_token(token)
        user_id = claims.get("sub")
        email = claims.get("email")
    except Exception:
        pass

    await revoke_token(payload.refreshToken)

    if user_id:
        await log_event(
            event_type="logout",
            user_id=user_id,
            email=email,
            ip=ip,
            user_agent=user_agent,
        )

    return LogoutResponse(success=True, data={})


@router.get("/me")
async def me(token: str = Depends(get_bearer_token)):
    """Return decoded JWT claims representing the authenticated user context."""
    try:
        claims = decode_token(token)
        return {"success": True, "data": claims}
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        )


from app.auth.schemas import CreateUserRequest, UpdateUserRequest
from app.core.iam_db import get_async_iam_db
from app.core.security import hash_password
from bson import ObjectId

@router.get("/roles")
async def list_roles(request: Request):
    """List all roles dynamically from MongoDB iam.roles and iam.users, strictly scoped to active organization."""
    db = await get_async_iam_db()
    
    # 1. Resolve active organization IDs
    active_org_id = request.headers.get("x-company-id") or request.headers.get("x-company")
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from app.core.security import decode_token
            token = auth_header.split(" ")[1]
            claims = decode_token(token)
            if not active_org_id:
                active_org_id = claims.get("orgId") or claims.get("companyId")
        except Exception:
            pass

    # Build active organization IDs set
    active_org_ids = set()
    if active_org_id:
        active_org_ids.add(str(active_org_id))
        org_doc = None
        if len(str(active_org_id)) == 24 and re.match(r"^[0-9a-fA-F]{24}$", str(active_org_id)):
            try:
                org_doc = await db["organizations"].find_one({"_id": ObjectId(active_org_id)})
            except Exception:
                pass
        if not org_doc:
            org_doc = await db["organizations"].find_one({
                "$or": [{"slug": active_org_id}, {"name": active_org_id}, {"displayName": active_org_id}]
            })
        if org_doc:
            active_org_ids.add(str(org_doc["_id"]))
            if org_doc.get("slug"): active_org_ids.add(org_doc["slug"])
            if org_doc.get("name"): active_org_ids.add(org_doc["name"])
            if org_doc.get("displayName"): active_org_ids.add(org_doc["displayName"])

    # Build valid organization IDs set across all existing organizations
    all_valid_org_ids = set()
    async for o in db["organizations"].find({}):
        all_valid_org_ids.add(str(o["_id"]))

    # Clean orphaned IDs from user documents and ensure ONLY 'organizations' array is stored
    async for u in db["users"].find({}):
        raw_orgs = u.get("organizations", u.get("companyIds", []))
        if not isinstance(raw_orgs, list): raw_orgs = [raw_orgs]
        cleaned_orgs = [str(cid) for cid in raw_orgs if str(cid) in all_valid_org_ids]
        if not cleaned_orgs and active_org_id and str(active_org_id) in all_valid_org_ids:
            cleaned_orgs = [str(active_org_id)]
        
        await db["users"].update_one(
            {"_id": u["_id"]},
            {
                "$set": {
                    "organizations": cleaned_orgs,
                    "updatedAt": datetime.utcnow()
                },
                "$unset": {
                    "companyIds": "",
                    "orgs": ""
                }
            }
        )

    roles = []
    seen_names = set()
    user_org_filter = {"organizations": {"$in": list(active_org_ids)}} if active_org_ids else {}

    # Fetch custom roles from database
    custom_roles_cursor = db["roles"].find({})
    async for r in custom_roles_cursor:
        r_id = str(r["_id"])
        r_name = r.get("name") or r_id
        seen_names.add(r_name.lower())
        if r.get("displayName"):
            seen_names.add(r.get("displayName").lower())

        role_match_query = {"role": {"$in": [r_id, r_name, r.get("displayName")]}}
        if user_org_filter:
            role_match_query.update(user_org_filter)

        users_count = await db["users"].count_documents(role_match_query)
        roles.append({
            "id": r_id,
            "name": r_name,
            "displayName": r.get("displayName") or r_name.replace("_", " ").title(),
            "description": r.get("description", ""),
            "permissions": r.get("permissions", {}),
            "isSystem": r.get("isSystem", False),
            "usersCount": users_count,
            "createdBy": r.get("createdBy", "Admin"),
            "createdAt": str(r.get("createdAt", "")),
            "updatedAt": str(r.get("updatedAt", ""))
        })

    # Dynamically include any unique role saved directly in iam.users documents for this active org
    user_query = user_org_filter if user_org_filter else {}
    distinct_user_roles = await db["users"].distinct("role", user_query)
    for ur in distinct_user_roles:
        if ur and str(ur).lower() not in seen_names:
            seen_names.add(str(ur).lower())
            match_q = {"role": ur}
            if user_org_filter: match_q.update(user_org_filter)
            users_count = await db["users"].count_documents(match_q)
            
            sample_user = await db["users"].find_one({**match_q, "permissions": {"$ne": {}}})
            user_perms = sample_user.get("permissions", {}) if sample_user else {}

            roles.append({
                "id": str(ur),
                "name": str(ur),
                "displayName": str(ur).replace("_", " ").title(),
                "description": f"Role assigned to {users_count} user(s) in organization",
                "permissions": user_perms,
                "isSystem": str(ur).lower() == "admin",
                "usersCount": users_count,
                "createdBy": "IAM Database",
                "createdAt": "",
                "updatedAt": ""
            })

    return {"success": True, "data": roles}

@router.post("/roles", status_code=status.HTTP_201_CREATED)
async def create_role(request: Request, payload: dict):
    """Create a new role with complete permission matrix in MongoDB iam.roles."""
    db = await get_async_iam_db()
    name = payload.get("name", "").strip()
    displayName = payload.get("displayName", name)
    description = payload.get("description", "")
    permissions = payload.get("permissions", {})

    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role name is required")

    slug_name = name.lower().replace(" ", "_")
    existing = await db["roles"].find_one({"$or": [{"name": slug_name}, {"displayName": displayName}]})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A role with this name already exists")

    role_doc = {
        "roleName": displayName,
        "name": slug_name,
        "displayName": displayName,
        "description": description,
        "permissions": permissions,
        "isSystem": False,
        "createdBy": "Admin",
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    res = await db["roles"].insert_one(role_doc)
    return {"success": True, "message": "Role created successfully", "data": {"id": str(res.inserted_id), "name": slug_name}}

@router.put("/roles/{role_id}")
async def update_role(role_id: str, payload: dict):
    """Update role permissions inside MongoDB iam.roles collection ONLY without modifying user documents."""
    db = await get_async_iam_db()
    displayName = payload.get("displayName") or payload.get("name")
    description = payload.get("description", "")
    permissions = payload.get("permissions", {})

    query = {}
    if len(role_id) == 24 and re.match(r"^[0-9a-fA-F]{24}$", role_id):
        try:
            query = {"_id": ObjectId(role_id)}
        except Exception:
            query = {"name": role_id}
    else:
        query = {"name": role_id}

    role_doc = await db["roles"].find_one(query)
    if not role_doc:
        role_doc = {
            "roleName": displayName or role_id.replace("_", " ").title(),
            "name": role_id,
            "displayName": displayName or role_id.replace("_", " ").title(),
            "description": description,
            "permissions": permissions,
            "isSystem": False,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        }
        res = await db["roles"].insert_one(role_doc)
    else:
        await db["roles"].update_one(
            {"_id": role_doc["_id"]},
            {"$set": {
                "displayName": displayName or role_doc.get("displayName"),
                "description": description,
                "permissions": permissions,
                "updatedAt": datetime.utcnow()
            }}
        )

    # Pure RBAC: Role permissions updated in iam.roles ONLY! Users store only roleId and inherit dynamically!
    return {"success": True, "message": "Role permissions updated in Roles collection successfully"}

@router.delete("/roles/{role_id}")
async def delete_role(role_id: str):
    """Delete role from iam.roles ONLY if no users are currently assigned to it."""
    db = await get_async_iam_db()
    
    query_roles = [role_id]
    if len(role_id) == 24 and re.match(r"^[0-9a-fA-F]{24}$", role_id):
        try:
            r_doc = await db["roles"].find_one({"_id": ObjectId(role_id)})
            if r_doc:
                query_roles.extend([str(r_doc["_id"]), r_doc.get("name"), r_doc.get("displayName")])
        except Exception:
            pass
    else:
        r_doc = await db["roles"].find_one({"$or": [{"name": role_id}, {"displayName": role_id}]})
        if r_doc:
            query_roles.extend([str(r_doc["_id"]), r_doc.get("name"), r_doc.get("displayName")])

    query_roles = [r for r in query_roles if r]

    # Check assigned users rule
    users_count = await db["users"].count_documents({"$or": [{"role": {"$in": query_roles}}, {"roleId": {"$in": query_roles}}]})
    if users_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This role is assigned to {users_count} user(s). Reassign users before deleting."
        )

    if len(role_id) == 24 and re.match(r"^[0-9a-fA-F]{24}$", role_id):
        try:
            await db["roles"].delete_one({"_id": ObjectId(role_id)})
        except Exception:
            pass
    else:
        await db["roles"].delete_one({"$or": [{"name": role_id}, {"displayName": role_id}]})

    return {"success": True, "message": "Role deleted successfully"}


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(request: Request, payload: CreateUserRequest):
    """Register user in iam.users storing ONLY roleId and user details (NO duplicated permissions object)."""
    db = await get_async_iam_db()

    active_org_id = request.headers.get("x-company-id") or request.headers.get("x-company")
    if not active_org_id:
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            try:
                from app.core.security import decode_token
                token = auth_header.split(" ")[1]
                claims = decode_token(token)
                active_org_id = claims.get("orgId") or claims.get("companyId")
            except Exception:
                pass
    
    # 1. Check if user already exists
    existing = await db["users"].find_one({"email": payload.email.strip().lower()})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists"
        )
        
    # 2. Hash password
    hashed_pwd = hash_password(payload.password)

    company_ids = payload.companyIds or ([active_org_id] if active_org_id else [])
    orgs_payload = [org.model_dump() for org in payload.orgs] if payload.orgs else (
        [{"orgId": active_org_id, "role": payload.role}] if active_org_id else []
    )
    
    # Pure RBAC: Do NOT store permissions object in user document! Store only user details and roleId!
    user_record = {
        "email": payload.email.strip().lower(),
        "passwordHash": hashed_pwd,
        "name": payload.name.strip(),
        "role": payload.role,
        "roleId": payload.role,
        "organizationId": active_org_id,
        "organizations": company_ids,
        "companyIds": company_ids,
        "orgs": orgs_payload,
        "phone": payload.phone,
        "department": getattr(payload, "department", "Accounting"),
        "designation": getattr(payload, "designation", "Staff"),
        "isActive": payload.isActive,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
        "lastLogin": None
    }

    result = await db["users"].insert_one(user_record)
    return {
        "success": True,
        "message": f"User '{payload.email}' successfully created",
        "data": {
            "id": str(result.inserted_id),
            "email": payload.email,
            "name": payload.name,
            "role": payload.role,
            "roleId": payload.role
        }
    }


@router.put("/users/{user_id}")
async def update_user(user_id: str, payload: UpdateUserRequest):
    """Update user details and roleId in iam.users without storing permissions object."""
    db = await get_async_iam_db()
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
        
    user = await db["users"].find_one({"_id": obj_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Pure RBAC: Update user details and roleId only! Remove any legacy permissions field!
    update_data = {
        "email": payload.email.strip().lower(),
        "name": payload.name.strip(),
        "role": payload.role,
        "roleId": payload.role,
        "organizations": payload.companyIds,
        "companyIds": payload.companyIds,
        "orgs": [org.model_dump() for org in payload.orgs],
        "phone": payload.phone,
        "department": getattr(payload, "department", user.get("department", "Accounting")),
        "designation": getattr(payload, "designation", user.get("designation", "Staff")),
        "isActive": payload.isActive,
        "updatedAt": datetime.utcnow()
    }

    if payload.password and payload.password.strip():
        update_data["passwordHash"] = hash_password(payload.password)

    await db["users"].update_one(
        {"_id": obj_id},
        {"$set": update_data, "$unset": {"permissions": ""}}
    )

    return {
        "success": True,
        "message": "User updated successfully",
        "data": {
            "id": user_id,
            "email": payload.email,
            "name": payload.name,
            "role": payload.role,
            "roleId": payload.role
        }
    }


from bson import ObjectId

@router.get("/users")
async def list_users(request: Request):
    """Retrieve users dynamically from IAM database, strictly filtered by current user's active organization."""
    db = await get_async_iam_db()

    # 1. Resolve user authorization from JWT token or header
    user_role = None
    active_org_id = request.headers.get("x-company-id") or request.headers.get("x-company")
    current_user_id = None

    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from app.core.security import decode_token
            from app.core.iam_service import get_user_by_id
            token = auth_header.split(" ")[1]
            claims = decode_token(token)
            user_role = claims.get("role")
            current_user_id = claims.get("sub")
            if not active_org_id:
                active_org_id = claims.get("orgId") or claims.get("companyId")
            
            if current_user_id:
                user_doc = await get_user_by_id(current_user_id)
                if user_doc:
                    user_role = user_doc.get("role", user_role)
        except Exception:
            pass

    active_org_ids = set()
    active_comp_name = "N/A"
    if active_org_id:
        active_org_id_str = str(active_org_id).strip()
        active_org_ids.add(active_org_id_str)
        try:
            from bson import ObjectId
            query_conds = [
                {"slug": active_org_id_str},
                {"name": active_org_id_str},
                {"displayName": active_org_id_str}
            ]
            if len(active_org_id_str) == 24 and re.match(r"^[0-9a-fA-F]{24}$", active_org_id_str):
                try:
                    query_conds.append({"_id": ObjectId(active_org_id_str)})
                except Exception:
                    pass
            active_org_doc = await db["organizations"].find_one({"$or": query_conds})
            if active_org_doc:
                org_id_str = str(active_org_doc["_id"])
                active_org_ids.add(org_id_str)
                if active_org_doc.get("slug"): active_org_ids.add(active_org_doc["slug"])
                if active_org_doc.get("name"): active_org_ids.add(active_org_doc["name"])
                if active_org_doc.get("displayName"): active_org_ids.add(active_org_doc["displayName"])
                active_comp_name = active_org_doc.get("displayName") or active_org_doc.get("name") or active_org_doc.get("companyName") or active_comp_name
        except Exception as e:
            print(f"Error resolving active organization doc in list_users: {e}")

    cursor = db["users"].find({})
    users = []
    async for u in cursor:
        u_id = str(u["_id"])
        u_org_ids = set()
        
        for o in (u.get("organizations") or []):
            if o: u_org_ids.add(str(o))
        for c in (u.get("companyIds") or []):
            if c: u_org_ids.add(str(c))
        for org in (u.get("orgs") or []):
            if isinstance(org, dict) and org.get("orgId"):
                u_org_ids.add(str(org.get("orgId")))

        # Enforce strict organization scoping for User & Role Management
        if active_org_ids:
            is_matched = bool(u_org_ids.intersection(active_org_ids)) or (u_id == str(current_user_id)) or (not u_org_ids)
            if not is_matched:
                continue

        comp_name = active_comp_name
        if comp_name == "N/A" and u_org_ids:
            primary_org_id = next(iter(u_org_ids))
            try:
                org_doc = None
                if len(primary_org_id) == 24 and re.match(r"^[0-9a-fA-F]{24}$", primary_org_id):
                    try:
                        org_doc = await db["organizations"].find_one({"_id": ObjectId(primary_org_id)})
                    except Exception:
                        pass
                if not org_doc:
                    org_doc = await db["organizations"].find_one({"_id": primary_org_id})
                if org_doc:
                    comp_name = org_doc.get("displayName") or org_doc.get("name") or org_doc.get("companyName") or comp_name
            except Exception:
                pass

        orgs_list = []
        if "orgs" in u and u["orgs"]:
            for org in u["orgs"]:
                if isinstance(org, dict):
                    orgs_list.append(org)
        else:
            fallback_ids = u.get("companyIds") or u.get("organizations") or []
            for oid in fallback_ids:
                orgs_list.append({"orgId": str(oid), "role": "MEMBER"})

        is_act = u.get("isActive", True)
        if "status" in u and u["status"] != "active":
            is_act = False

        last_log = u.get("lastLogin", "Never logged in")
        if isinstance(last_log, dict) and "$date" in last_log:
            last_log = last_log["$date"]

        users.append({
            "id": u_id,
            "email": u["email"],
            "name": u.get("name", ""),
            "role": u.get("role", "viewer"),
            "status": "active" if is_act else "inactive",
            "orgs": orgs_list,
            "company": comp_name,
            "permissions": u.get("permissions") if isinstance(u.get("permissions"), dict) else {},
            "apps": u.get("apps", []),
            "lastLogin": last_log
        })
    return {"success": True, "data": users}


from app.auth.schemas import UserPermissions

@router.put("/users/{user_id}/permissions")
async def update_user_permissions(user_id: str, payload: UserPermissions):
    """Dynamically update user permissions in the central IAM database."""
    db = await get_async_iam_db()
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
        
    result = await db["users"].update_one(
        {"_id": obj_id},
        {"$set": {"permissions": payload.model_dump()}}
    )
    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return {"success": True, "message": "Permissions updated successfully"}



@router.delete("/users/{user_id}")
async def delete_user(user_id: str):
    """Remove a system user from IAM database, protecting Organization Admin accounts."""
    db = await get_async_iam_db()
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )
        
    user = await db["users"].find_one({"_id": obj_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if str(user.get("role", "")).lower() == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization Admin account cannot be deleted."
        )

    result = await db["users"].delete_one({"_id": obj_id})
    return {"success": True, "message": "User deleted successfully"}


@router.post("/register-organization", status_code=status.HTTP_201_CREATED)
async def register_organization(payload: RegisterOrganizationRequest):
    """Register a new company/organization directly in IAM MongoDB and automatically create Organization Admin user account."""
    db = await get_async_iam_db()

    # 1. Check if user email already exists
    existing_user = await db["users"].find_one({"email": payload.email.strip().lower()})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists"
        )

    # 2. Slugify business name
    clean_name = payload.businessName.strip()
    org_slug = re.sub(r'[^a-z0-9]+', '-', clean_name.lower()).strip('-') or "org"
    db_name = f"tenant_{org_slug.replace('-', '_')}"

    # 3. Create organization record
    org_doc = {
        "name": clean_name,
        "displayName": clean_name,
        "slug": org_slug,
        "dbName": db_name,
        "status": "active",
        "email": payload.email.strip().lower(),
        "phone": payload.phone.strip() if payload.phone else "",
        "industry": payload.industry.strip() if payload.industry else "",
        "gstNo": payload.gstNo.strip() if payload.gstNo else None,
        "panNo": payload.panNo.strip() if payload.panNo else None,
        "address": payload.address.strip() if payload.address else "",
        "locality": payload.locality.strip() if payload.locality else "",
        "state": payload.state or "Madhya Pradesh",
        "city": payload.city or "",
        "country": payload.country or "India",
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }

    # Save inside MongoDB 'organizations' collection with unique ObjectId
    insert_res = await db["organizations"].insert_one(org_doc)
    org_id = str(insert_res.inserted_id)

    # 4. Automatically create Organization Admin user account
    admin_name = payload.adminName.strip() if payload.adminName else clean_name + " Admin"
    hashed_pwd = hash_password(payload.password)
    user_doc = {
        "email": payload.email.strip().lower(),
        "passwordHash": hashed_pwd,
        "name": admin_name,
        "phone": payload.phone.strip() if payload.phone else "",
        "role": "admin",
        "roleId": "admin",
        "status": "active",
        "isActive": True,
        "organizationId": org_id,
        "organizations": [org_id],
        "apps": ["finbook_erp", "livetally"],
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    user_res = await db["users"].insert_one(user_doc)

    # 5. Sync into main app database 'companies' collection as well
    try:
        from app.db import client as pymongo_client, ensure_tenant_db_structure
        main_db = pymongo_client["finbook_services"]
        main_db["companies"].update_one(
            {"_id": insert_res.inserted_id},
            {"$set": {
                "companyName": clean_name,
                "basicCompantFormalName": clean_name,
                "gstDetails": {
                    "gstin": payload.gstNo.strip() if payload.gstNo else "N/A",
                    "gstState": payload.state or "Madhya Pradesh",
                    "registrationType": "Regular",
                    "isGstOn": "Yes"
                },
                "status": "ACTIVE",
                "createdAt": datetime.utcnow()
            }},
            upsert=True
        )

        # 7. Initialize dedicated tenant database with all required project collections (excluding *_transactions)
        tenant_db = pymongo_client[db_name]
        ensure_tenant_db_structure(tenant_db)
    except Exception as e:
        print(f"Error syncing to main companies / initializing tenant DB: {e}")

    return {
        "success": True,
        "message": f"Organization '{clean_name}' and Organization Admin account created successfully",
        "data": {
            "orgId": org_id,
            "userId": str(user_res.inserted_id),
            "businessName": clean_name,
            "email": payload.email.strip().lower()
        }
    }








