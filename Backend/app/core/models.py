"""
app/core/models.py
==================
Shared Pydantic schemas representing IAM entities.
Supports Pydantic v2.
"""
from datetime import datetime
from typing import List, Optional, Union, Dict, Any
from pydantic import BaseModel, EmailStr, Field

class IAMOrganization(BaseModel):
    id: str = Field(alias="_id")
    slug: str
    name: str
    displayName: str
    dbName: str
    status: str = "active"
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }


class IAMUser(BaseModel):
    id: str = Field(alias="_id")
    email: EmailStr
    passwordHash: str
    name: str
    phone: Optional[str] = None
    role: str = "viewer"  # admin | accountant | viewer
    status: str = "active"  # active | inactive | suspended
    organizations: List[str] = Field(default_factory=list)
    permissions: Union[List[str], Dict[str, Any]] = Field(default_factory=list)
    apps: List[str] = Field(default_factory=list)  # e.g., ["finbook_erp", "livetally"]
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    lastLoginAt: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }


class TokenClaims(BaseModel):
    sub: str  # user id
    email: str
    name: str
    role: str
    orgId: Optional[str] = None
    orgDbName: Optional[str] = None
    orgName: Optional[str] = None
    permissions: Union[List[str], Dict[str, Any]] = Field(default_factory=list)
    apps: List[str] = Field(default_factory=list)
    type: str = "access"  # access | refresh


class SessionContext(BaseModel):
    user_id: str
    email: str
    name: str
    role: str
    org_id: Optional[str] = None
    org_db_name: Optional[str] = None
    org_name: Optional[str] = None
    permissions: Union[List[str], Dict[str, Any]] = Field(default_factory=list)
    apps: List[str] = Field(default_factory=list)
    raw_claims: dict
