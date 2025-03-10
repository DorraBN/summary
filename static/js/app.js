
document.getElementById("save-pdf-btn").addEventListener("click", function() {
            const summarizedText = document.getElementById("summarized-text").textContent;
            if (!summarizedText) {
                alert("Please summarize the text first.");
                return;
            }

            const formData = new FormData();
            formData.append("text", summarizedText);

            fetch("/download_pdf", {
                method: "POST",
                body: formData,
            })
            .then(response => response.blob())
            .then(blob => {
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = "summarized_text.pdf";
                link.click();
            })
            .catch(error => {
                console.error("Error downloading PDF:", error);
            });
        });







        document.getElementById("save-pdf-btn1").addEventListener("click", function() {
            const summarizedText = document.getElementById("video-summarized-text").textContent;
            if (!summarizedText) {
                alert("Please summarize the text first.");
                return;
            }

            const formData = new FormData();
            formData.append("text", summarizedText);

            fetch("/download_pdf", {
                method: "POST",
                body: formData,
            })
            .then(response => response.blob())
            .then(blob => {
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = "summarized_text.pdf";
                link.click();
            })
            .catch(error => {
                console.error("Error downloading PDF:", error);
            });
        });



  // Handle file upload
document.getElementById("upload-btn").addEventListener("click", function () {
    document.getElementById("file-upload").click();
});

// Handle file selection
document.getElementById("file-upload").addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
        document.getElementById("file-info").classList.remove("hidden");
        document.getElementById("file-name").textContent = file.name;
        document.getElementById("extract-btn").classList.remove("hidden");
    }
});

// Extract text from the uploaded file
document.getElementById("extract-btn").addEventListener("click", function () {
    const file = document.getElementById("file-upload").files[0];
    if (file) {
        const formData = new FormData();
        formData.append("file", file);

        fetch("/upload", {
            method: "POST",
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            document.getElementById("text-container").classList.remove("hidden");
            document.getElementById("extracted-text").textContent = data.extracted_text;
            
            // Update word count display for extracted text
            const extractedWordCount = countWords(data.extracted_text);
            document.getElementById("orig-word-count").textContent = extractedWordCount;
            
            // Update classification results for the extracted text
            updateClassificationResults(data.extracted_text);
        })
        .catch(error => {
            console.error("Error processing file:", error);
        });
    }
});

// Handle summarize button click for file text
document.getElementById("summarize-btn").addEventListener("click", function () {
    const extractedText = document.getElementById("extracted-text").textContent;
    const level = document.getElementById("summarization-level").value;

    document.getElementById("summarized-text").textContent = "Summarizing...";
    
    // Get original word count
    const originalWordCount = countWords(extractedText);
    document.getElementById("orig-word-count").textContent = originalWordCount;

    // Call summarization API
    fetch("/summarize", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: extractedText, level: level })
    })
    .then(response => response.json())
    .then(data => {
        // Update the summarized text and word count
        document.getElementById("summarized-text").textContent = data.summarized_text;

        const summarizedWordCount = countWords(data.summarized_text);
        document.getElementById("sum-word-count").textContent = summarizedWordCount;

        // Update classification for the summarized file text
        updateClassificationResults(data.summarized_text);
    })
    .catch(error => {
        console.error("Error summarizing text:", error);
    });
});

// Helper function to count words in a text
function countWords(text) {
    return text.trim().split(/\s+/).length;
}

// Function to update classification results
async function updateClassificationResults(text) {
    if (text.trim() !== "") {
        try {
            const response = await fetch("/summarize", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ text: text })
            });

            const data = await response.json();
            const category = data.classification?.category || "N/A";
            const sentiment = data.classification?.sentiment || "N/A";

            document.getElementById('classification-result').innerHTML = `
                <p><strong>Category: ${category}</strong></p>
                <p><strong>Sentiment: ${sentiment}</strong></p>
            `;
        } catch (error) {
            console.error("Error in classification:", error);
            document.getElementById('classification-result').innerHTML = "<p>Error in classification.</p>";
        }
    } else {
        document.getElementById('classification-result').innerHTML = "<p>No text to classify.</p>";
    }
}
    
    
    // Handle the Summarize Video button click

document.getElementById("upload-video-btn").addEventListener("click", function () {
        document.getElementById("video-upload").click(); // Open the file selection dialog
    });

    // When the user selects a video file
    document.getElementById("video-upload").addEventListener("change", function (event) {
        const videoFile = event.target.files[0];
        if (videoFile) {
            // Display the selected file's name
            document.getElementById("file-info-video").classList.remove("hidden");
            document.getElementById("video-file-name").textContent = videoFile.name;
        }
    });

    // Function to update classification results
    async function updateClassificationResults1(text) {
        if (text.trim() !== "") {
            try {
                const response = await fetch("/summarize", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ text: text })
                });

                const data = await response.json();
                const category = data.classification?.category || "N/A";
                const sentiment = data.classification?.sentiment || "N/A";

                document.getElementById('classification-result1').innerHTML = `
                    <p><strong>Category: ${category}</strong></p>
                    <p><strong>Sentiment: ${sentiment}</strong></p>
                `;
            } catch (error) {
                console.error("Error in classification:", error);
                document.getElementById('classification-result1').innerHTML = "<p>Error in classification.</p>";
            }
        } else {
            document.getElementById('classification-result1').innerHTML = "<p>No text to classify.</p>";
        }
    }

    // Handle the "Summarize Video" button click
    document.getElementById("summarize-video-btn").addEventListener("click", function () {
        const youtubeLink = document.getElementById("youtube-link").value;
        const videoFile = document.getElementById("video-upload").files[0];

        document.getElementById("video-summary").classList.remove("hidden");
        document.getElementById("video-extracted-text").textContent = "Extracting transcript...";
        document.getElementById("video-summarized-text").textContent = "Summarizing video...";

        if (youtubeLink) {
            // If YouTube link is provided, use it for summarization
            fetch("/summarize_video", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ url: youtubeLink })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                    return;
                }

                if (data.extracted_text && data.summarized_text) {
                    document.getElementById("video-extracted-text").textContent = data.extracted_text;
                    document.getElementById("video-summarized-text").textContent = data.summarized_text;
                    document.getElementById("original-word-count").textContent = data.original_word_count;
                    document.getElementById("summarized-word-count").textContent = data.summarized_word_count;
                    // Update classification for video summary
                    updateClassificationResults1(data.summarized_text);
                } else {
                    alert("There was an issue with the video data.");
                }
            })
            .catch(error => {
                console.error("Error summarizing video:", error);
            });
        } else if (videoFile) {
            // If video file is uploaded, use it for summarization
            const formData = new FormData();
            formData.append("file", videoFile);  

            fetch("/upload_video", {
                method: "POST",
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(data.error);
                    return;
                }

                uploadedFilePath = data.file_path; 

                // Now, trigger the summarization for the uploaded video
                fetch("/summarize_uploaded_video", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ file_path: uploadedFilePath })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        alert(data.error);
                        return;
                    }

                    document.getElementById("video-extracted-text").textContent = data.extracted_text;
                    document.getElementById("video-summarized-text").textContent = data.summarized_text;
                    document.getElementById("original-word-count").textContent = data.original_word_count;
                    document.getElementById("summarized-word-count").textContent = data.summarized_word_count;
                    // Update classification for video summary
                    updateClassificationResults1(data.summarized_text);
                })
                .catch(error => {
                    console.error("Error summarizing uploaded video:", error);
                });
            })
            .catch(error => {
                console.error("Error uploading video:", error);
            });
        } else {
            alert("Please enter a YouTube link or upload a video file.");
        }
    });
