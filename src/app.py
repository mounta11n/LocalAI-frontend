import socket
import struct
import numpy as np
import os
import sys
from flask import Flask, request, jsonify

app = Flask(__name__)

N_EMBD = 384

def embeddings_from_local_server(s, sock):
    sock.sendall(s.encode())
    data = sock.recv(N_EMBD*4)
    floats = struct.unpack('f' * N_EMBD, data)
    return floats

host = "localhost"
port = 8085
if len(sys.argv) > 1:
    port = int(sys.argv[1])

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.connect((host, port))
    N_EMBD = struct.unpack('i', sock.recv(4))[0]

    def embed_text(text):
        embedding = embeddings_from_local_server(text, sock)
        return np.array(embedding)

    txt_file = sys.argv[2] if len(sys.argv) > 2 else "semantic_source_file.txt"
    
    with open(os.path.join(os.path.dirname(__file__), txt_file), 'r') as f:
        texts = f.readlines()

    embedded_texts = [embed_text(text) for text in texts]

    def query(text, k=3):
        embedded_text = embed_text(text)
        
        similarities = [np.dot(embedded_text, embedded_text_i) / (np.linalg.norm(embedded_text) * np.linalg.norm(embedded_text_i)) for embedded_text_i in embedded_texts]
        
        sorted_indices = np.argsort(similarities)[::-1]
        
        closest_texts = [texts[i] for i in sorted_indices[:k]]
        closest_similarities = [similarities[i] for i in sorted_indices[:k]]
        
        return closest_texts, closest_similarities

@app.route('/query', methods=['POST'])
def query_route():
    data = request.get_json()
    input_text = data['input_text']
    k_value = data.get('k_value', 3)

    closest_texts, closest_similarities = query(input_text, k=k_value)

    response = {
        'closest_texts': closest_texts,
        'closest_similarities': closest_similarities
    }

    return jsonify(response)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)