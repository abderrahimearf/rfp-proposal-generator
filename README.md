# Backend Setup and Launch

This guide will explain how to clone the repository, install dependencies, and run the backend project.
##  Environment Variables

This project requires a `.env` file to store API keys and configuration values.  
The `.env` file is **not included** in the repository for security reasons.

### Steps to create it:

1. Create a new file named `.env` in the root of the backend project (same folder as `wsgi.py`).
2. Copy the content from `.env.example` into this `.env` file.
3. Replace the placeholder values with your own credentials.




## Installation

Follow these steps to set up the development environment.

### 1. Clone the Repository

First, clone the repository containing the `Backend` folder to your local machine. Replace `<REPOSITORY_URL>` with the project's URL.

```bash
git clone <REPOSITORY_URL>
```

### 2. If you don't have Poetry installed

```bash
pip install poetry
```

##### Note: After installation, you may need to restart your terminal or add Poetry's installation directory to your system's PATH.

### 3. Install Project Dependencies
```bash

poetry install
cd ./Backend

```
### 4. Download the model file

The main model file `svm_semantic_pipeline_final.joblib` is not included in this repository (too large for GitHub).

Please download it from Google Drive: [Download Link](https://drive.google.com/drive/folders/1ptcwGEApp7JCgbLcUSr_AYiPkjiPfJmx?usp=drive_link)

After downloading, place the file at:
```bash

backend/svm_semantic_pipeline_final.joblib
```

### 5. Running the Application
```bash

poetry run python wsgi.py
