# Backend Setup and Launch

This guide will explain how to clone the repository, install dependencies, and run the backend project.
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
### 4. Running the Application
```bash

poetry run python wsgi.py