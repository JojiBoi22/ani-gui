# ani-gui

A user-friendly, Netflix-inspired GUI for streaming anime, powered by `ani-cli`'s scraping capabilities and AllAnime/AniList APIs.

## Features
-   **Modern UI:** Clean, responsive interface with a dark theme, inspired by Netflix and Hayase.
-   **Anime Browsing:** Discover anime through search, or explore curated catalogs for Series, Movies, and Trending titles.
-   **Detailed View:** View anime details, including genres, status, and episode lists.
-   **Integrated Player:** Watch anime directly in the browser with multiple source and quality options, supporting HLS streams.
-   **Watchlist & History:** Keep track of your progress with persistent "Recently Watched" and "My List" features.
-   **Filtering:** Filter search results and catalogs by genre.
-   **Containerized Deployment:** Run the application seamlessly using Docker.

## Local Development Setup

### Prerequisites
-   Node.js (v20 or later recommended)
-   npm (or pnpm/yarn)

### Installation
1.  **Clone the repository:**
    ```bash
    git clone <your-github-repo-url>
    cd ani-gui
    ```
2.  **Install server dependencies:**
    ```bash
    cd server
    npm install
    cd ..
    ```
3.  **Install client dependencies:**
    ```bash
    cd client
    npm install
    cd ..
    ```

### Running Locally
1.  **Start the backend server:**
    ```bash
    cd server
    node index.js
    ```
    *(This will run on `http://localhost:3001`)*
2.  **Start the frontend development server:**
    ```bash
    cd client
    npm run dev
    ```
    *(This will run on `http://localhost:5173`)*

You can also use the `start-gui.sh` script:
```bash
./start-gui.sh
```
This script will manage both backend and frontend processes and open the app in your browser.

## Docker Setup

### Prerequisites
-   Docker installed and running.

### Running with Docker

1.  **Build and run the containers:**
    ```bash
    cd ani-gui
    ./start-docker.sh
    ```
    This script will build the Docker images for the server and client, start the containers, and map the ports. The application will be accessible at `http://localhost:5173`.

## Contributing

To contribute, please follow these steps:
1.  Clone the repository and navigate to the `ani-gui` directory.
2.  Install dependencies: `npm install` (in both `server` and `client` directories).
3.  Make your changes.
4.  Stage and commit your changes: `git add . && git commit -m "Your descriptive commit message"`
5.  Push to your branch: `git push origin <your-branch-name>`

## License
This project is under the [MIT License](). (Replace with actual license if applicable).
