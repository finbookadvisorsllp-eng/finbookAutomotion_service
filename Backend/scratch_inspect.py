from pymongo import MongoClient
import pprint

mongo_uri = "mongodb://localhost:27017/finbook_23aafff9731l1z7"
client = MongoClient(mongo_uri)
db = client["finbook_23aafff9731l1z7"]

records = list(db["bulk_uploads"].find())
for r in records:
    pprint.pprint(r)
