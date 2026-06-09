from pydantic import BaseModel
from typing import Optional

class CompanyResponse(BaseModel):
    id: str
    name: str
    gstin: Optional[str] = None
    createdAt: Optional[str] = None

class CreateCompanyRequest(BaseModel):
    name: str
    gstin: Optional[str] = None
