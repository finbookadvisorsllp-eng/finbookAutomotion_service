"""
app/scripts/seed_iam.py
=======================
Database seeding script for shared IAM database.
Creates initial organization and admin user if they do not exist.
Never deletes any existing databases or records.
"""
import sys
from pathlib import Path

# Add backend root to python path so we can import app modules
sys.path.append(str(Path(__file__).resolve().parent.parent.parent))

import asyncio
from app.core.iam_db import get_async_iam_db
from app.core.security import hash_password

async def seed():
    print("Connecting to IAM database...")
    db = await get_async_iam_db()

    # 1. Seed Organization
    org_slug = "friends-grafix"
    existing_org = await db["organizations"].find_one({"slug": org_slug})
    
    if not existing_org:
        print(f"Seeding organization: {org_slug}...")
        org_record = {
            "slug": org_slug,
            "name": "Friends Grafix FY 2024-25",
            "displayName": "Friends Grafix",
            "dbName": "finbook_23aafff9731l1z7",
            "status": "active"
        }
        insert_result = await db["organizations"].insert_one(org_record)
        org_id = str(insert_result.inserted_id)
        print(f"Organization seeded successfully with ID: {org_id}")
    else:
        org_id = str(existing_org["_id"])
        print(f"Organization '{org_slug}' already exists with ID: {org_id}")

    # 2. Seed User
    user_email = "anjaleebisen@gmail.com"
    existing_user = await db["users"].find_one({"email": user_email})

    if not existing_user:
        print(f"Seeding admin user: {user_email}...")
        raw_password = "password123"
        hashed = hash_password(raw_password)
        
        user_record = {
            "email": user_email,
            "passwordHash": hashed,
            "name": "Anjalee Bisen",
            "phone": None,
            "role": "admin",
            "status": "active",
            "organizations": [org_id],
            "permissions": ["*"],
            "apps": ["finbook_erp", "livetally"]
        }
        await db["users"].insert_one(user_record)
        print(f"User seeded successfully!")
        print(f"Credentials:")
        print(f"  Email:    {user_email}")
        print(f"  Password: {raw_password}")
    else:
        # Update password hash for seeded user to guarantee password123 works
        raw_password = "password123"
        hashed = hash_password(raw_password)
        linked_orgs = existing_user.get("organizations", [])
        if org_id not in linked_orgs:
            linked_orgs.append(org_id)
        await db["users"].update_one(
            {"_id": existing_user["_id"]},
            {"$set": {"passwordHash": hashed, "organizations": linked_orgs}}
        )
        print(f"User '{user_email}' updated with password '{raw_password}'.")

    print("IAM Seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed())
