from wctank import app
import sys

if __name__ == '__main__':
    app.debug = True
    if len(sys.argv) > 1:
        if sys.argv[1] == 'paul':
            app.paul = True
            print("paul's machine mode")
    app.run('0.0.0.0')
