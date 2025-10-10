from flask import Flask
app = Flask(__name__, static_folder=".", static_url_path="")

# Optional: if you want "/" to render index.html when running locally
from flask import send_from_directory
@app.route("/")
def root():
    return send_from_directory(".", "index.html")

