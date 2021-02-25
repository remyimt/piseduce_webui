from database.base import DB_URL
from database.tables import User
from database.connector import create_tables, open_session, close_session
import logging

logging.basicConfig(level=logging.INFO,
    format='%(asctime)s %(levelname)-8s %(message)s', datefmt='%Y-%m-%d %H:%M:%S')
logging.info("Create the tables from the URL '%s'" % DB_URL)
if create_tables():
    logging.info("Database initialization complete")
    # Create the admin user
    db = open_session()
    admin = User()
    admin.email = "admin@piseduce.fr"
    admin.password = \
        "sha256$kFAl3lBK$d48c4bd2ff12742351b219af6c4aff6d4cb9893b9b6146f6ea8d8a06c7a9a436"
    admin.is_authorized = True
    admin.is_admin = True
    db.add(admin)
    close_session(db)
else:
    logging.error("Fail to initialize the database")
