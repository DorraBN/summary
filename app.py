from flask import Flask, redirect, render_template, request, jsonify, send_file, url_for
from werkzeug.utils import secure_filename
import os
import PyPDF2
from fpdf import FPDF
from transformers import pipeline
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import JSONFormatter
import re
import sqlite3
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash
from werkzeug.security import check_password_hash
import moviepy.editor as mp
import whisper
from moviepy.editor import VideoFileClip
from transformers import BartTokenizer, pipeline
# Initialize Flask app
app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root@localhost/text'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

#count words
def count_words(text):
    return len(text.split())

# model 
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    password = db.Column(db.String(255), nullable=False) 


with app.app_context():
    db.create_all()
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

# Function to extract text from PDF
import pdfplumber

def extract_text_from_pdf(filepath):
    try:
        extension = os.path.splitext(filepath)[1].lower()
        if extension == ".txt":
            with open(filepath, "r", encoding="utf-8") as file:
                return file.read()

       
        elif extension == ".pdf":
            text = ""

            try:
                
                with open(filepath, "rb") as file:
                    reader = PyPDF2.PdfReader(file)
                    text = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
                
                
                if not text.strip():
                    with pdfplumber.open(filepath) as pdf:
                        text = "\n".join([page.extract_text() for page in pdf.pages if page.extract_text()])
                
                return text if text.strip() else "Error: No text extracted from PDF."
            
            except Exception as e:
                return f"Error extracting text from PDF: {str(e)}"
        
        else:
            return "Error: Unsupported file type."

    except Exception as e:
        return f"Error reading file: {str(e)}"

# Save pdf
def save_text_as_pdf(text, filename="extracted_text.pdf"):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.multi_cell(0, 10, text)
    pdf_path = os.path.join(UPLOAD_FOLDER, filename)
    pdf.output(pdf_path)
    return pdf_path
tokenizer = BartTokenizer.from_pretrained("facebook/bart-large-cnn")
# Summarize text with T5-small
def summarize_text_with_t5(text):
     # Tokenize the input text
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=1024)

    # Extract the tokenized text from the inputs
    input_ids = inputs["input_ids"]

    # Ensure text length does not exceed model's max tokens (1024 for BART)
    if len(input_ids[0]) > 1024:
        input_ids = input_ids[:, :1024]  # Truncate to the first 1024 tokens

    # Decode the input text back for summarization
    text_for_summary = tokenizer.decode(input_ids[0], skip_special_tokens=True)

    try:
        # Summarize the text
        summary = summarizer(text_for_summary, max_length=200, min_length=1, do_sample=False)
        return summary[0]['summary_text']
    except Exception as e:
        return f"Error during summarization: {str(e)}"

def is_valid_youtube_url(url):
    youtube_regex = r'(https?://(?:www\.)?youtube\.com/watch\?v=([^&]+))'
    return re.match(youtube_regex, url)


# Summarize video and classify text
@app.route('/summarize_video', methods=['POST'])
def summarize_video():
    video_url = request.json.get('url', '')

    if not video_url:
        return jsonify({'error': 'No YouTube link provided'}), 400

    if not is_valid_youtube_url(video_url):
        return jsonify({'error': 'Invalid YouTube URL format'}), 400

    video_id = video_url.split("v=")[-1]
    if '&' in video_id:
        video_id = video_id.split('&')[0]
    
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        transcript_text = " ".join([entry['text'] for entry in transcript])
        
        # Debugging: Check the extracted transcript text
        print("Extracted Transcript:", transcript_text)
        
        # Summarize the transcript text
        summarized_text = summarize_text_with_t5(transcript_text)
        
        # Calculate word counts
        original_word_count = count_words(transcript_text)
        summarized_word_count = count_words(summarized_text)
        
        # Perform classification on the transcript text
        category, sentiment = classify_text(transcript_text)

        # Return extracted, summarized text, and classification results
        return jsonify({
            'extracted_text': transcript_text,
            'summarized_text': summarized_text,
            'original_word_count': original_word_count,
            'summarized_word_count': summarized_word_count,
            'classification': {
                'category': category,
                'sentiment': sentiment
            }
        })
    except Exception as e:
        return jsonify({'error': f'Error processing video transcript: {str(e)}'}), 400


#upload file
@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    text = extract_text_from_pdf(filepath)
    
    return jsonify({'extracted_text': text})

#summarize file
@app.route('/summarize', methods=['POST'])
@app.route('/summarize', methods=['POST'])
def summarize():
    text = request.json.get('text', '')
    if not text:
        return jsonify({'error': 'No text provided for summarization'}), 400
    
    summarized_text = summarize_text_with_t5(text)
    category, sentiment = classify_text(text)
    
    # Renvoi de la réponse avec les bons champs
    response = {
        'original_text': text,
        'summarized_text': summarized_text,
        'classification': {
            'category': category,
            'sentiment': sentiment
        }
    }

    return jsonify(response)






#download pdf
@app.route('/download_pdf', methods=['POST'])
def download_pdf():
    text = request.form['text']
    pdf_path = save_text_as_pdf(text)
    return send_file(pdf_path, as_attachment=True)

# SQLite Functions
def insert_user(username, email, phone, password):
    conn = sqlite3.connect('form_data.db')
    cursor = conn.cursor()
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT,
        email TEXT,
        phone TEXT,
        password TEXT
    )
    ''')

    cursor.execute('''
    INSERT INTO users (username, email, phone, password)
    VALUES (?, ?, ?, ?)
    ''', (username, email, phone, password))

    conn.commit()
    conn.close()

@app.route('/register_user', methods=['POST'])
def register_user():
    try:
        data = request.get_json() 

        if not all(k in data for k in ("username", "email", "phone", "password")):
            return jsonify({"error": "Missing data"}), 400
        
        existing_user = User.query.filter((User.email == data['email']) | (User.phone == data['phone'])).first()
        if existing_user:
            return jsonify({"error": "User already exists with this email or phone number"}), 400
        
        new_user = User(
            username=data['username'],
            email=data['email'],
            phone=data['phone'],
            password=data['password'] 
        )
        
        db.session.add(new_user)
        db.session.commit()

        return jsonify({"success": True}), 201  

    except Exception as e:
        print("Server error:", str(e))
        return jsonify({"error": "Internal server error"}), 500


#login
@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()

    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email or password missing"}), 400

    user = User.query.filter_by(email=email).first()

    if not user or user.password != password: 
        return jsonify({"error": "Invalid email or password"}), 400
    return jsonify({"success": True})

#index
@app.route('/index.html')  
def index():
    return render_template('index.html')

#home
@app.route('/')
def home():
    return render_template('login.html')



#classification 
classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

candidate_labels = [
    "Tech", "Health", "Finance", "Politics", "Sports", "Education", 
    "Entertainment", "Science", "Life", "Spirit", "Business", "Economy", 
    "Culture", "Travel", "Environment", "Art", "Lifestyle", "Food", "Music", 
    "Fashion", "History", "Philosophy", "Law", "Gaming", "Social Media", 
    "Psychology", "Human Rights", "Religion", "Security", "Transportation", 
    "Real Estate", "Marketing", "Agriculture", "Retail", "Startup", 
    "Non-profit", "Management", "Innovation", "Artificial Intelligence", 
    "Blockchain", "Climate Change", "Space Exploration", "Astronomy", 
    "Geopolitics", "Languages", "Technology Trends", "Virtual Reality", 
    "Medicine", "Genetics", "Nanotechnology", "Cybersecurity", "Cryptocurrency", 
    "Workplace", "Public Policy", "Global Health", "Sustainability", 
    "Telecommunications", "Manufacturing", "Industry 4.0", "Automation", 
    "E-commerce", "Crowdsourcing", "Digital Transformation", "Biotechnology", 
    "Quantum Computing", "Smart Cities", "Renewable Energy", "Artificial Life",
    "Design", "Philanthropy", "Public Relations", "Corporate Social Responsibility", 
    "Media", "Journalism", "Books", "Movies", "Theater", "Television", 
    "Podcasts", "Comics", "Photography", "Video Games", "Events"
]


def classify_text(text):
   
    category_result = classifier(text, candidate_labels=candidate_labels)
    
    
    print("Category result:", category_result)  

    if 'labels' in category_result and len(category_result['labels']) > 0:
        category = category_result['labels'][0]  
    else:
        category = "N/A"  
    
    
    sentiment_analyzer = pipeline("sentiment-analysis")
    sentiment_result = sentiment_analyzer(text)
    
   
    print("Sentiment result:", sentiment_result)  
    
 
    if isinstance(sentiment_result, list) and len(sentiment_result) > 0:
        sentiment_label = sentiment_result[0]['label']
    else:
        sentiment_label = 'Unknown'  
    
    print(f"Category: {category}, Sentiment: {sentiment_label}")  

    return category, sentiment_label

# Route to upload video
@app.route('/upload_video', methods=['POST'])
def upload_video():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        return jsonify({'message': f'File {filename} uploaded successfully', 'file_path': filepath})

    except Exception as e:
        return jsonify({'error': f'Error processing video: {str(e)}'}), 500

# Route to summarize the uploaded video
@app.route('/summarize_uploaded_video', methods=['POST'])
def summarize_uploaded_video():
    try:
        video_path = request.json.get('file_path', '')
        if not video_path:
            return jsonify({'error': 'No video file path provided'}), 400

        # Extract audio and transcribe
        audio_path = extract_audio_from_video(video_path)
        transcribed_text = transcribe_audio(audio_path)
        summarized_text = summarize_text_with_t5(transcribed_text)
        original_word_count = count_words(transcribed_text)
        summarized_word_count = count_words(summarized_text)
        category, sentiment = classify_text(summarized_text)

        return jsonify({
            'extracted_text': transcribed_text,
            'summarized_text': summarized_text,
            'original_word_count': original_word_count,
            'summarized_word_count': summarized_word_count,
            'classification': {'category': category, 'sentiment': sentiment}
        })

    except Exception as e:
        return jsonify({'error': f'Error summarizing video: {str(e)}'}), 500



def extract_audio_from_video(video_path):
    # Open the video file
    video = VideoFileClip(video_path)
    
    # Generate the audio file path by changing the extension from the video format to '.mp3'
    audio_path = os.path.splitext(video_path)[0] + '.mp3'
    
    # Write the audio file
    video.audio.write_audiofile(audio_path)
    
    return audio_path

def transcribe_audio(audio_path):
    model = whisper.load_model("base")  
    result = model.transcribe(audio_path)
    return result["text"]

#classification 
classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")
sentiment_analyzer = pipeline("sentiment-analysis")

candidate_labels = [
    "Tech", "Health", "Finance", "Politics", "Sports", "Education", 
    "Entertainment", "Science", "Life", "Spirit", "Business", "Economy", 
    "Culture", "Travel", "Environment", "Art", "Lifestyle", "Food", "Music", 
    "Fashion", "History", "Philosophy", "Law", "Gaming", "Social Media", 
    "Psychology", "Human Rights", "Religion", "Security", "Transportation", 
    "Real Estate", "Marketing", "Agriculture", "Retail", "Startup", 
    "Non-profit", "Management", "Innovation", "Artificial Intelligence", 
    "Blockchain", "Climate Change", "Space Exploration", "Astronomy", 
    "Geopolitics", "Languages", "Technology Trends", "Virtual Reality", 
    "Medicine", "Genetics", "Nanotechnology", "Cybersecurity", "Cryptocurrency", 
    "Workplace", "Public Policy", "Global Health", "Sustainability", 
    "Telecommunications", "Manufacturing", "Industry 4.0", "Automation", 
    "E-commerce", "Crowdsourcing", "Digital Transformation", "Biotechnology", 
    "Quantum Computing", "Smart Cities", "Renewable Energy", "Artificial Life",
    "Design", "Philanthropy", "Public Relations", "Corporate Social Responsibility", 
    "Media", "Journalism", "Books", "Movies", "Theater", "Television", 
    "Podcasts", "Comics", "Photography", "Video Games", "Events"
]


def classify_text(text):
    
    MAX_TOKENS = 512
    text = text[:MAX_TOKENS]


    try:
        category_result = classifier(text, candidate_labels=candidate_labels)
        category = category_result.get("labels", ["N/A"])[0]  
    except Exception as e:
        print(f"Erreur lors de la classification : {e}")
        category = "N/A"

    try:
        sentiment_result = sentiment_analyzer(text)
        sentiment_label = sentiment_result[0].get("label", "Unknown") if sentiment_result else "Unknown"
    except Exception as e:
        print(f"Erreur lors de l'analyse du sentiment : {e}")
        sentiment_label = "Unknown"

    return category, sentiment_label



#main
if __name__ == '__main__':
    app.run(debug=True)
