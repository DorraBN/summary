from flask import Flask, redirect, render_template, request, jsonify, send_file, url_for,session
from werkzeug.utils import secure_filename
import os
import PyPDF2
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
import torch
from fpdf import FPDF
from transformers import pipeline
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import JSONFormatter
import re
from concurrent.futures import ThreadPoolExecutor
from transformers import pipeline, BartForConditionalGeneration, BartTokenizer
import sqlite3
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash
from werkzeug.security import check_password_hash
import moviepy.editor as mp
from concurrent.futures import ProcessPoolExecutor
import whisper
from moviepy.editor import VideoFileClip
from transformers import BartTokenizer, pipeline
from functools import wraps
# Initialize Flask app
app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://root@localhost/text'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False




db = SQLAlchemy(app)


app.secret_key = os.urandom(24)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('home'))  
        return f(*args, **kwargs)
    return decorated_function

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
model = BartForConditionalGeneration.from_pretrained("facebook/bart-large-cnn")
tokenizer = BartTokenizer.from_pretrained("facebook/bart-large-cnn")

summarizer = pipeline("summarization", model=model, tokenizer=tokenizer)
from accelerate import Accelerator
accelerator = Accelerator()
summarizer = accelerator.prepare(summarizer)
model = model.to(accelerator.device)

import pdfplumber
def split_large_text(text, max_length=1024):
    return [text[i:i+max_length] for i in range(0, len(text), max_length)]
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

def clean_transcript(transcript):
  
    return re.sub(r'\d+:\d{2}:\d{2}.\d{3}', '', transcript)

def split_text_into_chunks(text, max_length=1024):
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""
    for paragraph in paragraphs:
        if len(current_chunk + "\n" + paragraph) > max_length:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = paragraph
        else:
            current_chunk += "\n" + paragraph
    if current_chunk:
        chunks.append(current_chunk.strip())
    return chunks

def summarize_chunk(chunk):
    return summarizer(chunk, max_length=1024)[0]['summary_text']

def summarize_text_with_chunks(text):
    chunks = split_text_into_chunks(text)
    with ThreadPoolExecutor() as executor:
        summaries = list(executor.map(summarize_chunk, chunks))
    return " ".join(summaries)

@app.route('/summarize', methods=['POST'])
def summarize():

    text = request.json.get('text', '')
    if not text:
        return jsonify({'error': 'No text provided for summarization'}), 400
    
    
    summarized_text = summarize_text_with_chunks(text)
    
  
    cleaned_summarized_text = remove_unwanted_text(summarized_text)
    
    
    category, sentiment = classify_text(text)

   
    response = {
        'original_text': text,
        'summarized_text': cleaned_summarized_text, 
        'classification': {
            'category': category,
            'sentiment': sentiment
        }
    }

    return jsonify(response)
def summarize_text_with_t5(text):
   
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=200)

  
    input_ids = inputs["input_ids"]

   
    if len(input_ids[0]) > 200:
        input_ids = input_ids[:, :200] 

  
    text_for_summary = tokenizer.decode(input_ids[0], skip_special_tokens=True)

    try:
       
        summary = summarizer(text_for_summary, max_length=100, min_length=1, do_sample=False)
        return summary[0]['summary_text']
    except Exception as e:
        return f"Error during summarization: {str(e)}"


@app.route('/summarize_description', methods=['POST'])
def summarize_description():
   
    text = request.json.get('text', '')

    if not text:
        return jsonify({'error': 'No text provided for summarization'}), 400
    

    summarized_text = summarize_text_with_chunks(text)
    

    cleaned_summarized_text = remove_unwanted_text(summarized_text)
    

    category, sentiment = classify_text(text)

    response = {
        'original_text': text,
        'summarized_text': cleaned_summarized_text, 
        'classification': {
            'category': category,
            'sentiment': sentiment
        }
    }

 
    return jsonify(response)

def is_valid_youtube_url(url):
    youtube_regex = r'(https?://(?:www\.)?youtube\.com/watch\?v=([^&]+))'
    return re.match(youtube_regex, url)

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
        
     
        cleaned_transcript_text = remove_unwanted_text(transcript_text)

       
        summarized_text = summarize_text_with_chunks(cleaned_transcript_text)
        cleaned_summarized_text = remove_unwanted_text(summarized_text)
        
        original_word_count = count_words(transcript_text)
        summarized_word_count = count_words(cleaned_summarized_text)
        
        # Classify the text
        category, sentiment = classify_text(cleaned_transcript_text)

        return jsonify({
            'extracted_text': cleaned_transcript_text,  
            'summarized_text': cleaned_summarized_text,  
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
    data = request.get_json()

    username = data.get('username')
    email = data.get('email')
    phone = data.get('phone')
    password = data.get('password')

    # Validate input fields
    if not username or not email or not phone or not password:
        return jsonify({"error": "All fields are required"}), 400

    # Check if the email already exists
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({"error": "Email already in use"}), 400

    # Hash the password before saving (use a secure method like bcrypt or scrypt)
    hashed_password = generate_password_hash(password)

    # Create the new user
    new_user = User(username=username, email=email, phone=phone, password=hashed_password)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({"success": True}), 201



#login

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()

    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email or password missing"}), 400

    # Query the user by email
    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({"error": "Invalid email or password"}), 400

    # Verify the password
    if not check_password_hash(user.password, password):  
        return jsonify({"error": "Invalid email or password"}), 400

    # Store user information in the session
    session['user_id'] = user.id
    session['username'] = user.username
    session['email'] = user.email

    return jsonify({"success": True}), 200


@app.route('/logout', methods=['POST'])
def logout():
    session.clear()  
    return redirect(url_for('home'))

@app.route('/index.html')
@login_required
def index():
    return render_template('index.html')

@app.route('/video.html')
@login_required
def video():
    return render_template('video.html')

@app.route('/pdf.html')
@login_required
def pdf():
    return render_template('pdf.html')

#home
@app.route('/')
def home():
    if 'user_id' in session:
        return redirect(url_for('index')) 
    return render_template('login.html')



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
        summarized_text = summarize_text_with_chunks(transcribed_text)
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
classifier = pipeline("zero-shot-classification", model="distilbert-base-uncased")

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
  
    sentences = text.split('. ')
    
    sentiments = []
    
    for sentence in sentences:
        sentiment = classify_sentiment(sentence)
        sentiments.append(sentiment)

    sentiment_result = check_for_contradiction(sentiments)
   
    category_result = classifier(text, candidate_labels=candidate_labels)
    category = category_result.get("labels", ["N/A"])[0]

    return category, sentiment_result

def remove_unwanted_text(text):
    unwanted_text = "CNN.com will feature iReporter photos in a weekly Travel Snapshots gallery. Please submit your best shots of the U.S. for next week. Visit CNN.com/Travel next Wednesday for a new gallery of snapshots. Please share your best photos of the United States with CNN iReport."
    
    cleaned_text = text.replace(unwanted_text, "")
    
    return cleaned_text






sentiment_analyzer = pipeline("sentiment-analysis")

def classify_sentiment(text):
    sentiment_result = sentiment_analyzer(text)

    if sentiment_result[0]['label'] == 'POSITIVE':
        return "Positive"
    elif sentiment_result[0]['label'] == 'NEGATIVE':
        return "Negative"
    else:
        return "Neutral"

def check_for_contradiction(sentiments):
   
    positive_count = sentiments.count("Positive")
    negative_count = sentiments.count("Negative")

    if positive_count > 0 and negative_count > 0:
        return "Mixed (Positive + Negative)"
    elif positive_count > 0:
        return "Positive"
    elif negative_count > 0:
        return "Negative"
    else:
        return "Neutral"








#main
if __name__ == '__main__':
    app.run(debug=True)
