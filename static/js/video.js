document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("summarize-video-btn").addEventListener("click", function () {
        const youtubeLink = document.getElementById("youtube-link").value;
        const videoFile = document.getElementById("video-upload").files[0];
  
        document.getElementById("video-summary").classList.add("hidden");
        document.getElementById("video-extracted-text").textContent = "";
        document.getElementById("video-summarized-text").textContent = "";

        document.getElementById("save-pdf-btn1").classList.add("hidden");
        document.getElementById("classification-result").classList.add("hidden");
        document.getElementById("classification-loader").classList.remove("hidden");

      
        if (!youtubeLink && !videoFile) {
            alert("Please enter a YouTube link or upload a video file.");
            document.getElementById("classification-loader").classList.add("hidden");
            return; 
        }

       
        document.getElementById("video-summary").classList.remove("hidden");

     
        if (youtubeLink) {
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
                    document.getElementById("classification-loader").classList.add("hidden");
                    return;
                }

                if (data.extracted_text && data.summarized_text) {
                    document.getElementById("video-extracted-text").textContent = data.extracted_text;
                    document.getElementById("video-summarized-text").textContent = data.summarized_text;
                    document.getElementById("original-word-count").textContent = data.original_word_count;
                    document.getElementById("summarized-word-count").textContent = data.summarized_word_count;

                    updateClassificationResults1(data.summarized_text);
                    document.getElementById("save-pdf-btn1").classList.remove("hidden");
                    document.getElementById("classification-loader").classList.add("hidden");
                    document.getElementById("classification-result").classList.remove("hidden");
                } else {
                    alert("There was an issue with the video data.");
                }
            })
            .catch(error => {
                console.error("Error summarizing video:", error);
            });
        }
        
        else if (videoFile) {
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
                    document.getElementById("classification-loader").classList.add("hidden");
                    return;
                }

                uploadedFilePath = data.file_path;

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
                        document.getElementById("classification-loader").classList.add("hidden");
                        return;
                    }

                    document.getElementById("video-extracted-text").textContent = data.extracted_text;
                    document.getElementById("video-summarized-text").textContent = data.summarized_text;
                    document.getElementById("original-word-count").textContent = data.original_word_count;
                    document.getElementById("summarized-word-count").textContent = data.summarized_word_count;

                    updateClassificationResults1(data.summarized_text);
                    document.getElementById("save-pdf-btn1").classList.remove("hidden");
                    document.getElementById("classification-loader").classList.add("hidden");
                    document.getElementById("classification-result").classList.remove("hidden");
                })
                .catch(error => {
                    console.error("Error summarizing uploaded video:", error);
                });
            })
            .catch(error => {
                console.error("Error uploading video:", error);
            });
        }
    });

  
    document.getElementById("upload-video-btn").addEventListener("click", function () {
        document.getElementById("video-upload").click();
    });

    document.getElementById("video-upload").addEventListener("change", function (event) {
        const videoFile = event.target.files[0];
        if (videoFile) {
            document.getElementById("file-info-video").classList.remove("hidden");
            document.getElementById("video-file-name").textContent = videoFile.name;
        }
    });
});


document.getElementById("upload-video-btn").addEventListener("click", function () {
    document.getElementById("video-upload").click(); 
});


document.getElementById("video-upload").addEventListener("change", function (event) {
    const videoFile = event.target.files[0];
    if (videoFile) {
        
        document.getElementById("file-info-video").classList.remove("hidden");
        document.getElementById("video-file-name").textContent = videoFile.name;
    }
});
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

            
            document.getElementById('classification-result').innerHTML = `
                <p><strong>Category: ${category}</strong></p>
                <p><strong>Sentiment: ${sentiment}</strong></p>
            `;

            
            document.getElementById('classification-result').classList.remove('hidden');

        } catch (error) {
            console.error("Error in classification:", error);
            document.getElementById('classification-result').innerHTML = "<p>Error in classification.</p>";
            document.getElementById('classification-result').classList.remove('hidden');
        }
    } else {
        document.getElementById('classification-result').innerHTML = "<p>No text to classify.</p>";
        document.getElementById('classification-result').classList.remove('hidden');
    }
}

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

document.getElementById('user-icon').addEventListener('click', function() {
    const logoutMenu = document.getElementById('logout-menu');
    logoutMenu.classList.toggle('hidden');
});