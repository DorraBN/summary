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
    
        document.getElementById("global-loader").classList.remove("hidden");

        const formData = new FormData();
        formData.append("file", file);

        fetch("/upload", {
            method: "POST",
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
         
            document.getElementById("global-loader").classList.add("hidden");

        
            document.getElementById("text-container").classList.remove("hidden");
            document.getElementById("extracted-text").textContent = data.extracted_text;


            const extractedWordCount = countWords(data.extracted_text);
            document.getElementById("orig-word-count").textContent = extractedWordCount;

            updateClassificationResults(data.extracted_text);
        })
        .catch(error => {
  
            document.getElementById("global-loader").classList.add("hidden");
            console.error("Error processing file:", error);
        });
    }
});

document.getElementById("summarize-btn").addEventListener("click", async function () {
    const extractedText = document.getElementById("extracted-text").textContent;
    const level = document.getElementById("summarization-level").value;

    document.getElementById("summarized-text").textContent = "Summarizing...";


    const originalWordCount = countWords(extractedText);
    document.getElementById("orig-word-count").textContent = originalWordCount;

    try {
     
        const response = await fetch("/summarize", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: extractedText, level: level })
        });

        const data = await response.json();
        const summarizedText = data.summarized_text;

      
        document.getElementById("summarized-text").textContent = summarizedText;

        const summarizedWordCount = countWords(summarizedText);
        document.getElementById("sum-word-count").textContent = summarizedWordCount;

    
        document.getElementById("textclass").classList.remove("hidden");

        await updateClassificationResults(summarizedText);

 
        document.getElementById("save-pdf-btn").classList.remove("hidden");

    } catch (error) {
        console.error("Error summarizing text:", error);
        document.getElementById("summarized-text").textContent = "Error summarizing the text.";
    }
});


async function updateClassificationResults1(text) {
    if (text.trim() !== "") {
        try {
            const response = await fetch("/summarize_description", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ text: text })
            });

            const data = await response.json();
            const category = data.classification?.category || "N/A";
            const sentiment = data.classification?.sentiment || "N/A";

            document.getElementById('classification-result1').classList.remove("hidden");
            document.getElementById('category').textContent = `Category: ${category}`;
            document.getElementById('sentiment').textContent = `Sentiment: ${sentiment}`;
        } catch (error) {
            console.error("Error in classification:", error);
            document.getElementById('classification-result1').classList.remove("hidden");
            document.getElementById('category').textContent = "Error in classification.";
            document.getElementById('sentiment').textContent = "";
        }
    } else {
        document.getElementById('classification-result1').classList.remove("hidden");
        document.getElementById('category').textContent = "No text to classify.";
        document.getElementById('sentiment').textContent = "";
    }
}


function countWords(text) {
    return text.trim().split(/\s+/).length;
}



    
// Handle the Save as PDF button click
document.getElementById("save-pdf-btn").addEventListener("click", function () {
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

          
            document.getElementById("classification-result").classList.remove("hidden");
            document.getElementById("classification-result").innerHTML = `
                <p><strong>Category: ${category}</strong></p>
                <p><strong>Sentiment: ${sentiment}</strong></p>
            `;
        } catch (error) {
            console.error("Error in classification:", error);
           
            document.getElementById("classification-result").classList.remove("hidden");
            document.getElementById("classification-result").innerHTML = "<p>Error in classification.</p>";
        }
    } else {
       
        document.getElementById("classification-result").classList.remove("hidden");
        document.getElementById("classification-result").innerHTML = "<p>No text to classify.</p>";
    }
}
document.getElementById('user-icon').addEventListener('click', function() {
    const logoutMenu = document.getElementById('logout-menu');
    logoutMenu.classList.toggle('hidden');
});



/////////////////////////////////////////////////////

document.getElementById("summarize-manual-btn").addEventListener("click", function () {
    const manualDescription = document.getElementById("manual-description").value.trim();
    if (manualDescription) {
       
        document.getElementById("summarized-manual-text-container").classList.add("hidden");
        document.getElementById("summarize-manual-btn").classList.add("hidden");
        document.getElementById("global-loader").classList.remove("hidden");

        fetch("/summarize_description", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: manualDescription })
        })
        .then(response => response.json())
        .then(data => {
         
            document.getElementById("summarized-manual-text-container").classList.remove("hidden");
            document.getElementById("summarized-manual-text").textContent = data.summarized_text;
            document.getElementById("global-loader").classList.add("hidden");

            updateClassificationResults1(data.summarized_text);

           
            document.getElementById("save-pdf-btn1").classList.remove("hidden");
            document.getElementById("textclass1").classList.remove("hidden");
        })
        .catch(error => {
            console.error("Error summarizing description:", error);
            document.getElementById("classification-loader").classList.add("hidden");
            document.getElementById("summarized-manual-text-container").classList.remove("hidden");
            document.getElementById("summarized-manual-text").textContent = "Error summarizing the text.";
        });
    } else {
        alert("Please enter a description or summary.");
    }
});


document.getElementById("save-pdf-btn1").addEventListener("click", function () {
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

// Helper function to count words in a text
function countWords(text) {
    return text.trim().split(/\s+/).length;
}

// Function to update classification results (for summarized manual text)

async function updateClassificationResults1(text) {
    if (text.trim() !== "") {
       
       
    

        try {
            const response = await fetch("/summarize_description", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ text: text })
            });

            const data = await response.json();
            const category = data.classification?.category || "N/A";
            const sentiment = data.classification?.sentiment || "N/A";

            document.getElementById("classification-result1").classList.remove("hidden");
            document.getElementById("classification-result1").innerHTML = `
                <p><strong>Category: ${category}</strong></p>
                <p><strong>Sentiment: ${sentiment}</strong></p>
            `;
        } catch (error) {
            console.error("Error in classification:", error);
           
            document.getElementById("classification-result1").classList.remove("hidden");
            document.getElementById("classification-result1").innerHTML = "<p>Error in classification.</p>";
        }
    } else {
       
        document.getElementById("classification-result1").classList.remove("hidden");
        document.getElementById("classification-result1").innerHTML = "<p>No text to classify.</p>";
    }
}
document.getElementById('user-icon').addEventListener('click', function() {
    const logoutMenu = document.getElementById('logout-menu');
    logoutMenu.classList.toggle('hidden');
});



document.getElementById("save-pdf-btn1").addEventListener("click", function () {
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
document.getElementById('user-icon').addEventListener('click', function() {
    const logoutMenu = document.getElementById('logout-menu');
    logoutMenu.classList.toggle('hidden');
});