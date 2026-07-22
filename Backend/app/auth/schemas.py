"""
app/auth/schemas.py
===================
Input/Output schemas for shared auth APIs.
"""
from typing import List, Optional, Any
from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OrgMembership(BaseModel):
    orgId: str
    role: str = "MEMBER"


class PermissionActions(BaseModel):
    create: bool = False
    read: bool = False
    update: bool = False
    delete: bool = False


class UserPermissions(BaseModel):
    dashboard: PermissionActions = PermissionActions()
    manualVoucher: PermissionActions = PermissionActions()
    bulkUpload: PermissionActions = PermissionActions()
    masters: PermissionActions = PermissionActions()
    approval: PermissionActions = PermissionActions()
    ocrUpload: PermissionActions = PermissionActions()
    tallyConnector: PermissionActions = PermissionActions()
    documentArchive: PermissionActions = PermissionActions()
    configuration: PermissionActions = PermissionActions()


class UserData(BaseModel):
    id: str
    email: str
    name: str
    role: str
    companyIds: List[str] = []
    orgs: List[OrgMembership] = []
    phone: str = ""
    isActive: bool = True
    permissions: Optional[UserPermissions] = None





class OrgData(BaseModel):
    id: str
    slug: str
    name: str
    displayName: str
    status: str


class LoginResponseData(BaseModel):
    token: str
    refreshToken: str
    user: UserData
    organizations: List[OrgData]


class LoginResponse(BaseModel):
    success: bool = True
    data: LoginResponseData


class SelectOrgRequest(BaseModel):
    organizationId: str


class SelectOrgResponseData(BaseModel):
    token: str
    refreshToken: str
    organization: OrgData


class SelectOrgResponse(BaseModel):
    success: bool = True
    data: SelectOrgResponseData


class RefreshRequest(BaseModel):
    refreshToken: str


class RefreshResponseData(BaseModel):
    token: str


class RefreshResponse(BaseModel):
    success: bool = True
    data: RefreshResponseData


class LogoutRequest(BaseModel):
    refreshToken: str


class LogoutResponse(BaseModel):
    success: bool = True
    data: Optional[dict] = None





class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "viewer"
    organizations: List[str] = []
    companyIds: List[str] = []
    orgs: List[OrgMembership] = []
    phone: str = ""
    isActive: bool = True
    permissions: Optional[UserPermissions] = None


class UpdateUserRequest(BaseModel):
    name: str
    email: EmailStr
    role: str
    organizations: List[str] = []
    companyIds: List[str] = []
    orgs: List[OrgMembership] = []
    phone: str = ""
    isActive: bool = True
    password: Optional[str] = None
    permissions: Optional[UserPermissions] = None


class RegisterOrganizationRequest(BaseModel):
    businessName: str
    email: EmailStr
    password: str
    adminName: Optional[str] = ""
    phone: Optional[str] = ""
    industry: Optional[str] = ""
    gstNo: Optional[str] = ""
    panNo: Optional[str] = ""
    address: Optional[str] = ""
    locality: Optional[str] = ""
    state: Optional[str] = "Madhya Pradesh"
    city: Optional[str] = ""
    country: Optional[str] = "India"






