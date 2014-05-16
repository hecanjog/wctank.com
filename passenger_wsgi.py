import os
import sys

INTERP = os.path.join(os.environ['HOME'], 'wctank.com', 'bin', 'python')
if sys.executable != INTERP:
    try:
        os.execl(INTERP, INTERP, *sys.argv)
    except OSError:
        pass

sys.path.append(os.getcwd())
import app as application
