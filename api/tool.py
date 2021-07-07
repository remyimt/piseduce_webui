from cryptography.fernet import Fernet


# sort node names that must be used the pattern 'string-number'
def sort_by_name(named_dict):
    result = {}
    names = {}
    for name in named_dict:
        key_name = ""
        if "-" in name:
            key_name = name.split("-")[0]
        else:
            key_name = name
        if key_name not in names:
            names[key_name] = []
        names[key_name].append(name)
    for n_str in sorted(names):
        if len(names[n_str]) > 1:
            nb_sorted = sorted(names[n_str], key=lambda nb: int(nb.split("-")[1]))
            for n in nb_sorted:
                result[n] = named_dict[n]
        else:
            key = names[n_str][0]
            result[key] = named_dict[key]
    return result


def decrypt_password(pwd):
    with open("secret.key", "r") as keyfile:
        key = keyfile.read()
        f = Fernet(key)
        return f.decrypt(pwd.encode()).decode()
    return ""
