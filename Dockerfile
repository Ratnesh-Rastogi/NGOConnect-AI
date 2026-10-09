FROM node:22-alpine

WORKDIR /app

# Install dependencies in the image so the host machine does not need
# npm dependencies or PostgreSQL installed for Docker-based development.
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
COPY shared/api-client-react/package.json ./shared/api-client-react/package.json
COPY shared/api-spec/package.json ./shared/api-spec/package.json
COPY shared/api-zod/package.json ./shared/api-zod/package.json
COPY shared/db/package.json ./shared/db/package.json

RUN npm ci

# Copy the application source after dependencies so dependency changes
# invalidate the install layer while normal code edits remain lightweight.
COPY . .

EXPOSE 3000 5173

CMD ["npm", "run", "dev"]
