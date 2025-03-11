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
document.getElementById("summarize-btn").addEventListener("click", async function () {
    const extractedText = document.getElementById("extracted-text").textContent;
    const level = document.getElementById("summarization-level").value;

    // Afficher un message de résumé en cours
    document.getElementById("summarized-text").textContent = "Summarizing...";

    // Récupérer le nombre de mots d'origine
    const originalWordCount = countWords(extractedText);
    document.getElementById("orig-word-count").textContent = originalWordCount;

    try {
        // Appel de l'API de résumé
        const response = await fetch("/summarize", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: extractedText, level: level })
        });

        const data = await response.json();

        // Mettre à jour le texte résumé et le nombre de mots
        document.getElementById("summarized-text").textContent = data.summarized_text;

        const summarizedWordCount = countWords(data.summarized_text);
        document.getElementById("sum-word-count").textContent = summarizedWordCount;

        // Afficher le titre "Classification Result" après le résumé
        document.getElementById("textclass").classList.remove("hidden");

        // Mettre à jour la classification pour le texte résumé
        await updateClassificationResults(data.summarized_text);

        // Afficher le bouton "Enregistrer en PDF" après le résumé
        document.getElementById("save-pdf-btn").classList.remove("hidden");

    } catch (error) {
        console.error("Error summarizing text:", error);
        document.getElementById("summarized-text").textContent = "Error summarizing the text.";
    }
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
        // Afficher le loader et masquer les résultats de classification
        document.getElementById("classification-loader").classList.remove("hidden");
        document.getElementById("classification-result").classList.add("hidden");

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

            // Cacher le loader et afficher les résultats
            document.getElementById("classification-loader").classList.add("hidden");
            document.getElementById("classification-result").classList.remove("hidden");
            document.getElementById("classification-result").innerHTML = `
                <p><strong>Category: ${category}</strong></p>
                <p><strong>Sentiment: ${sentiment}</strong></p>
            `;
        } catch (error) {
            console.error("Error in classification:", error);
            document.getElementById("classification-loader").classList.add("hidden");
            document.getElementById("classification-result").classList.remove("hidden");
            document.getElementById("classification-result").innerHTML = "<p>Error in classification.</p>";
        }
    } else {
        document.getElementById("classification-loader").classList.add("hidden");
        document.getElementById("classification-result").classList.remove("hidden");
        document.getElementById("classification-result").innerHTML = "<p>No text to classify.</p>";
    }
}
document.getElementById('user-icon').addEventListener('click', function() {
    const logoutMenu = document.getElementById('logout-menu');
    logoutMenu.classList.toggle('hidden');
});



/////////////////////////////////////////////////////

// Handle the "Summarize Text" button click event
document.getElementById("summarize-manual-btn").addEventListener("click", function () {
    const manualDescription = document.getElementById("manual-description").value.trim();
    if (manualDescription) {
        // Display the loading spinner and hide the summarize button
        document.getElementById("summarized-manual-text-container").classList.add("hidden");
        document.getElementById("classification-loader").classList.remove("hidden");

        // Send the manual description to the backend for summarization
        fetch("/summarize_description", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: manualDescription })
        })
        .then(response => response.json())
        .then(data => {
            // Hide the loader and display the summarized text
            document.getElementById("classification-loader").classList.add("hidden");
            document.getElementById("summarized-manual-text-container").classList.remove("hidden");

            document.getElementById("summarized-manual-text").textContent = data.summarized_text;

            // Optionally, you can implement word count here
            const summarizedWordCount = countWords(data.summarized_text);
            document.getElementById("sum-word-count").textContent = summarizedWordCount;

            // Show the "Save as PDF" button after summarization
            document.getElementById("save-pdf-btn").classList.remove("hidden");

            // Update classification results for the summarized text
            updateClassificationResults(data.summarized_text);
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
