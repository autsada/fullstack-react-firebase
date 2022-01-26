# Full-Stack eCommerce App

## Demo
https://awesome-9bbcd.web.app/

## Technologies Stack

- React
- Firebase
- Stripe
- ShipStation
- Algolia

## Usage
**Credit cards for testing**
- 4242424242424242
- 5555555555554444

**User for admin area testing**
- email: ```tim@test.com```
- password: ```abc123```

## Clone and Test Locally
1. Env for react app
    ```
    REACT_APP_apiKey="FIREBASE_PROJECT_API_KEY"
    REACT_APP_authDomain="FIREBASE_PROJECT_AUTH_DOMAIN"
    REACT_APP_databaseURL="FIREBASE_PROJECT_DATABASE_URL"
    REACT_APP_projectId="FIREBASE_PROJECT_PROJECT_ID"
    REACT_APP_storageBucket="FIREBASE_PROJECT_STORAGE_BUCKET"
    REACT_APP_messagingSenderId="FIREBASE_PROJECT_MESSAGE_SENDER_ID"
    REACT_APP_appId="FIREBASE_PROJECT_APP_ID"
    REACT_APP_STRIPE_PUBLISHABLE_KEY='STRIPE_PUBLISHABLE_KEY'
    ```
2. Env in Cloud Functions
    ```
    {
        "algolia": {
          "app_id": "ALGOLIA_APP_ID",
          "admin_api_key": "ALGOLIA_ADMIN_API_KEY"
        },
        "stripe": {
            "signing_key": "STRIPE_SIGNING_KEY",
            "secret_key": "STRIPE_SECRET_KEY"
        },
        "shipstation": {
            "api_secret": "SHIPSTATION_API_SECRET",
            "api_key": "SHIPSTATION_API_KEY"
        }
        "admin": {
            "super_admin": "THE_EMAIL_TO_BE_USED_AS_SUPER_ADMIN"
        }
    }
    ```
4. Start the app
    ```npm install ```
    ```npm start```

