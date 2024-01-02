import swaggerJSDoc from "swagger-jsdoc";

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Throw Crate - CSS",
    version: "1.0.0",
    description: "API developed to serve the Throw Crate frontend that was developed for the subject Cloud Computing at Politechnika",
  },
  tags: [
    {
      name: "User routes",
      description: "API endpoints related to user operations",
    },
    {
      name: "File routes",
      description: "API endpoints related to file operations",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        in: "header",
        name: "Authorization",
        description: "Bearer token to access these api endpoints",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ["src/routes.js"], // Substitua pelo caminho correto para seus arquivos de rotas
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
