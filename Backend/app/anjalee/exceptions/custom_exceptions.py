from fastapi import HTTPException, status

class TransactionNotFoundException(HTTPException):
    def __init__(self, detail: str = "Transaction not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)

class CompanyNotFoundException(HTTPException):
    def __init__(self, detail: str = "Company not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)

class InvalidDatabaseOperationException(HTTPException):
    def __init__(self, detail: str = "Database operation failed"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
