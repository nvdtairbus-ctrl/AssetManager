from flask import Flask, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/prices')
def get_prices():
    return send_from_directory('.', 'prices.json')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)