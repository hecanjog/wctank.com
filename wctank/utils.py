import hashlib

def md5Hexdigest(string):
    h = hashlib.md5()
    h.update(string)
    return h.hexdigest()

