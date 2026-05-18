import sqlite3
import os

source_db = 'database.db'
dest_db = 'database_new.db'

# Connect to the source database
try:
    src_conn = sqlite3.connect(source_db)
    dst_conn = sqlite3.connect(dest_db)

    # Use the backup API to copy the database
    with dst_conn:
        src_conn.backup(dst_conn)

    print("Backup successful.")

except Exception as e:
    print(f"Error: {e}")
finally:
    if 'src_conn' in locals():
        src_conn.close()
    if 'dst_conn' in locals():
        dst_conn.close()

# If successful, swap them
try:
    os.remove(source_db)
    os.rename(dest_db, source_db)
    print("Database swapped successfully.")
except Exception as e:
    print(f"Could not swap: {e}")
    # Force rename if possible, or just delete original and try again
