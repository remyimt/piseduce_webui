from cryptography.fernet import Fernet

"""
Generates a key and save it into a file
"""
key = Fernet.generate_key()
with open("secret.key", "wb") as key_file:
    key_file.write(key)
