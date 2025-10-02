"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CdkAppStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
class CdkAppStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // DynamoDB table for products
        const productsTable = new dynamodb.Table(this, 'ProductsTable', {
            tableName: 'products-table',
            partitionKey: { name: 'productId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            pointInTimeRecovery: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });
        // Lambda function to get all products
        const getProductsFunction = new lambda.Function(this, 'GetProductsFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

        const client = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(client);

        exports.handler = async (event) => {
          try {
            const command = new ScanCommand({
              TableName: process.env.TABLE_NAME
            });
            
            const result = await docClient.send(command);
            
            return {
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
              },
              body: JSON.stringify(result.Items || [])
            };
          } catch (error) {
            console.error('Error:', error);
            return {
              statusCode: 500,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({ error: 'Internal server error' })
            };
          }
        };
      `),
            environment: {
                TABLE_NAME: productsTable.tableName
            }
        });
        // Lambda function to get single product
        const getProductFunction = new lambda.Function(this, 'GetProductFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromInline(`
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

        const client = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(client);

        exports.handler = async (event) => {
          try {
            const productId = event.pathParameters?.id;
            
            if (!productId) {
              return {
                statusCode: 400,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Product ID is required' })
              };
            }

            const command = new GetCommand({
              TableName: process.env.TABLE_NAME,
              Key: { productId }
            });
            
            const result = await docClient.send(command);
            
            if (!result.Item) {
              return {
                statusCode: 404,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Product not found' })
              };
            }
            
            return {
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
              },
              body: JSON.stringify(result.Item)
            };
          } catch (error) {
            console.error('Error:', error);
            return {
              statusCode: 500,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({ error: 'Internal server error' })
            };
          }
        };
      `),
            environment: {
                TABLE_NAME: productsTable.tableName
            }
        });
        // Lambda function to populate sample data
        const populateDataFunction = new lambda.Function(this, 'PopulateDataFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            timeout: cdk.Duration.minutes(5),
            code: lambda.Code.fromInline(`
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
        const crypto = require('crypto');

        const client = new DynamoDBClient({});
        const docClient = DynamoDBDocumentClient.from(client);

        const sampleProducts = [
          {
            name: "MacBook Pro 16-inch",
            category: "Electronics",
            brand: "Apple",
            price: 2499.99,
            description: "High-performance laptop for professionals",
            specifications: {
              weight: "2.1 kg",
              dimensions: { width: "35.57 cm", height: "24.59 cm", depth: "1.68 cm" },
              color: "Space Gray",
              processor: "M3 Pro chip",
              memory: "18GB unified memory",
              storage: "512GB SSD"
            }
          },
          {
            name: "Nike Air Max 270",
            category: "Footwear",
            brand: "Nike",
            price: 150.00,
            description: "Comfortable running shoes with air cushioning",
            specifications: {
              weight: "0.8 kg",
              color: "Black/White",
              material: "Mesh and synthetic leather",
              sole: "Rubber outsole",
              technology: "Air Max cushioning"
            }
          },
          {
            name: "Samsung 55-inch QLED TV",
            category: "Electronics",
            brand: "Samsung",
            price: 899.99,
            description: "4K Smart TV with quantum dot technology",
            specifications: {
              weight: "17.6 kg",
              dimensions: { width: "123.1 cm", height: "70.7 cm", depth: "5.9 cm" },
              resolution: "3840 x 2160",
              display: "QLED",
              smartPlatform: "Tizen OS",
              connectivity: ["WiFi", "Bluetooth", "HDMI", "USB"]
            }
          },
          {
            name: "Organic Cotton T-Shirt",
            category: "Clothing",
            brand: "EcoWear",
            price: 29.99,
            description: "Sustainable organic cotton t-shirt",
            specifications: {
              weight: "0.2 kg",
              material: "100% Organic Cotton",
              color: "Navy Blue",
              sizes: ["XS", "S", "M", "L", "XL"],
              care: "Machine wash cold",
              certification: "GOTS certified"
            }
          },
          {
            name: "Instant Pot Duo 7-in-1",
            category: "Kitchen",
            brand: "Instant Pot",
            price: 79.99,
            description: "Multi-functional electric pressure cooker",
            specifications: {
              weight: "5.4 kg",
              dimensions: { width: "32.5 cm", height: "31.5 cm", depth: "33 cm" },
              capacity: "6 quarts",
              functions: ["Pressure Cook", "Slow Cook", "Rice Cooker", "Steamer", "Sauté", "Yogurt Maker", "Warmer"],
              material: "Stainless steel inner pot",
              safety: "10 safety mechanisms"
            }
          }
        ];

        exports.handler = async (event) => {
          try {
            const results = [];
            
            for (const product of sampleProducts) {
              const productWithId = {
                ...product,
                productId: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              
              const command = new PutCommand({
                TableName: process.env.TABLE_NAME,
                Item: productWithId
              });
              
              await docClient.send(command);
              results.push(productWithId.productId);
            }
            
            return {
              statusCode: 200,
              body: JSON.stringify({
                message: 'Sample data populated successfully',
                productIds: results
              })
            };
          } catch (error) {
            console.error('Error:', error);
            return {
              statusCode: 500,
              body: JSON.stringify({ error: 'Failed to populate sample data' })
            };
          }
        };
      `),
            environment: {
                TABLE_NAME: productsTable.tableName
            }
        });
        // Grant DynamoDB permissions to Lambda functions
        productsTable.grantReadData(getProductsFunction);
        productsTable.grantReadData(getProductFunction);
        productsTable.grantWriteData(populateDataFunction);
        // API Gateway
        const api = new apigateway.RestApi(this, 'ProductsApi', {
            restApiName: 'Products API',
            description: 'API for accessing product specifications',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key']
            }
        });
        // API Gateway integrations
        const getProductsIntegration = new apigateway.LambdaIntegration(getProductsFunction);
        const getProductIntegration = new apigateway.LambdaIntegration(getProductFunction);
        // API Gateway resources and methods
        const products = api.root.addResource('products');
        products.addMethod('GET', getProductsIntegration);
        const product = products.addResource('{id}');
        product.addMethod('GET', getProductIntegration);
        // Outputs
        new cdk.CfnOutput(this, 'ApiUrl', {
            value: api.url,
            description: 'API Gateway URL'
        });
        new cdk.CfnOutput(this, 'TableName', {
            value: productsTable.tableName,
            description: 'DynamoDB Table Name'
        });
        new cdk.CfnOutput(this, 'PopulateDataFunctionName', {
            value: populateDataFunction.functionName,
            description: 'Function to populate sample data'
        });
    }
}
exports.CdkAppStack = CdkAppStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2RrLWFwcC1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNkay1hcHAtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFFbkMsbUVBQXFEO0FBQ3JELCtEQUFpRDtBQUNqRCx1RUFBeUQ7QUFHekQsTUFBYSxXQUFZLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDeEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4Qiw4QkFBOEI7UUFDOUIsTUFBTSxhQUFhLEdBQUcsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDOUQsU0FBUyxFQUFFLGdCQUFnQjtZQUMzQixZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRTtZQUN4RSxXQUFXLEVBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxlQUFlO1lBQ2pELG1CQUFtQixFQUFFLElBQUk7WUFDekIsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztTQUN6QyxDQUFDLENBQUM7UUFFSCxzQ0FBc0M7UUFDdEMsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLHFCQUFxQixFQUFFO1lBQzNFLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGVBQWU7WUFDeEIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O09BcUM1QixDQUFDO1lBQ0YsV0FBVyxFQUFFO2dCQUNYLFVBQVUsRUFBRSxhQUFhLENBQUMsU0FBUzth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QVcsRUFBRTtZQUNuQyxLQUFLLEVBQUUsYUFBYSxDQUFDLFNBQVM7WUFDOUIsV0FBVyxFQUFFLHFCQUFxQjtTQUNuQyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLDBCQUEwQixFQUFFO1lBQ2xELEtBQUssRUFBRSxvQkFBb0IsQ0FBQyxZQUFZO1lBQ3hDLFdBQVcsRUFBRSxrQ0FBa0M7U0FDaEQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBblRELGtDQW1UQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcblxuZXhwb3J0IGNsYXNzIENka0FwcFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgLy8gRHluYW1vREIgdGFibGUgZm9yIHByb2R1Y3RzXG4gICAgY29uc3QgcHJvZHVjdHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUHJvZHVjdHNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ3Byb2R1Y3RzLXRhYmxlJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncHJvZHVjdElkJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICBwb2ludEluVGltZVJlY292ZXJ5OiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWVxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIHRvIGdldCBhbGwgcHJvZHVjdHNcbiAgICBjb25zdCBnZXRQcm9kdWN0c0Z1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0UHJvZHVjdHNGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUlubGluZShgXG4gICAgICAgIGNvbnN0IHsgRHluYW1vREJDbGllbnQgfSA9IHJlcXVpcmUoJ0Bhd3Mtc2RrL2NsaWVudC1keW5hbW9kYicpO1xuICAgICAgICBjb25zdCB7IER5bmFtb0RCRG9jdW1lbnRDbGllbnQsIFNjYW5Db21tYW5kIH0gPSByZXF1aXJlKCdAYXdzLXNkay9saWItZHluYW1vZGInKTtcblxuICAgICAgICBjb25zdCBjbGllbnQgPSBuZXcgRHluYW1vREJDbGllbnQoe30pO1xuICAgICAgICBjb25zdCBkb2NDbGllbnQgPSBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LmZyb20oY2xpZW50KTtcblxuICAgICAgICBleHBvcnRzLmhhbmRsZXIgPSBhc3luYyAoZXZlbnQpID0+IHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgY29tbWFuZCA9IG5ldyBTY2FuQ29tbWFuZCh7XG4gICAgICAgICAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuVEFCTEVfTkFNRVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKGNvbW1hbmQpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiAnR0VULCBPUFRJT05TJyxcbiAgICAgICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6ICdDb250ZW50LVR5cGUnXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHJlc3VsdC5JdGVtcyB8fCBbXSlcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDUwMCxcbiAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJ1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnSW50ZXJuYWwgc2VydmVyIGVycm9yJyB9KVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICBgKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIFRBQkxFX05BTUU6IHByb2R1Y3RzVGFibGUudGFibGVOYW1lXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGEgZnVuY3Rpb24gdG8gZ2V0IHNpbmdsZSBwcm9kdWN0XG4gICAgY29uc3QgZ2V0UHJvZHVjdEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnR2V0UHJvZHVjdEZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3QgeyBEeW5hbW9EQkNsaWVudCB9ID0gcmVxdWlyZSgnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJyk7XG4gICAgICAgIGNvbnN0IHsgRHluYW1vREJEb2N1bWVudENsaWVudCwgR2V0Q29tbWFuZCB9ID0gcmVxdWlyZSgnQGF3cy1zZGsvbGliLWR5bmFtb2RiJyk7XG5cbiAgICAgICAgY29uc3QgY2xpZW50ID0gbmV3IER5bmFtb0RCQ2xpZW50KHt9KTtcbiAgICAgICAgY29uc3QgZG9jQ2xpZW50ID0gRHluYW1vREJEb2N1bWVudENsaWVudC5mcm9tKGNsaWVudCk7XG5cbiAgICAgICAgZXhwb3J0cy5oYW5kbGVyID0gYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHByb2R1Y3RJZCA9IGV2ZW50LnBhdGhQYXJhbWV0ZXJzPy5pZDtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKCFwcm9kdWN0SWQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiA0MDAsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKidcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdQcm9kdWN0IElEIGlzIHJlcXVpcmVkJyB9KVxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBjb21tYW5kID0gbmV3IEdldENvbW1hbmQoe1xuICAgICAgICAgICAgICBUYWJsZU5hbWU6IHByb2Nlc3MuZW52LlRBQkxFX05BTUUsXG4gICAgICAgICAgICAgIEtleTogeyBwcm9kdWN0SWQgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGRvY0NsaWVudC5zZW5kKGNvbW1hbmQpO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBpZiAoIXJlc3VsdC5JdGVtKSB7XG4gICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogNDA0LFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnUHJvZHVjdCBub3QgZm91bmQnIH0pXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAgICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6ICdHRVQsIE9QVElPTlMnLFxuICAgICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogJ0NvbnRlbnQtVHlwZSdcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkocmVzdWx0Lkl0ZW0pXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvcjonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiA1MDAsXG4gICAgICAgICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKidcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ0ludGVybmFsIHNlcnZlciBlcnJvcicgfSlcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgYCksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBUQUJMRV9OQU1FOiBwcm9kdWN0c1RhYmxlLnRhYmxlTmFtZVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gTGFtYmRhIGZ1bmN0aW9uIHRvIHBvcHVsYXRlIHNhbXBsZSBkYXRhXG4gICAgY29uc3QgcG9wdWxhdGVEYXRhRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdQb3B1bGF0ZURhdGFGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tSW5saW5lKGBcbiAgICAgICAgY29uc3QgeyBEeW5hbW9EQkNsaWVudCB9ID0gcmVxdWlyZSgnQGF3cy1zZGsvY2xpZW50LWR5bmFtb2RiJyk7XG4gICAgICAgIGNvbnN0IHsgRHluYW1vREJEb2N1bWVudENsaWVudCwgUHV0Q29tbWFuZCB9ID0gcmVxdWlyZSgnQGF3cy1zZGsvbGliLWR5bmFtb2RiJyk7XG4gICAgICAgIGNvbnN0IGNyeXB0byA9IHJlcXVpcmUoJ2NyeXB0bycpO1xuXG4gICAgICAgIGNvbnN0IGNsaWVudCA9IG5ldyBEeW5hbW9EQkNsaWVudCh7fSk7XG4gICAgICAgIGNvbnN0IGRvY0NsaWVudCA9IER5bmFtb0RCRG9jdW1lbnRDbGllbnQuZnJvbShjbGllbnQpO1xuXG4gICAgICAgIGNvbnN0IHNhbXBsZVByb2R1Y3RzID0gW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6IFwiTWFjQm9vayBQcm8gMTYtaW5jaFwiLFxuICAgICAgICAgICAgY2F0ZWdvcnk6IFwiRWxlY3Ryb25pY3NcIixcbiAgICAgICAgICAgIGJyYW5kOiBcIkFwcGxlXCIsXG4gICAgICAgICAgICBwcmljZTogMjQ5OS45OSxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkhpZ2gtcGVyZm9ybWFuY2UgbGFwdG9wIGZvciBwcm9mZXNzaW9uYWxzXCIsXG4gICAgICAgICAgICBzcGVjaWZpY2F0aW9uczoge1xuICAgICAgICAgICAgICB3ZWlnaHQ6IFwiMi4xIGtnXCIsXG4gICAgICAgICAgICAgIGRpbWVuc2lvbnM6IHsgd2lkdGg6IFwiMzUuNTcgY21cIiwgaGVpZ2h0OiBcIjI0LjU5IGNtXCIsIGRlcHRoOiBcIjEuNjggY21cIiB9LFxuICAgICAgICAgICAgICBjb2xvcjogXCJTcGFjZSBHcmF5XCIsXG4gICAgICAgICAgICAgIHByb2Nlc3NvcjogXCJNMyBQcm8gY2hpcFwiLFxuICAgICAgICAgICAgICBtZW1vcnk6IFwiMThHQiB1bmlmaWVkIG1lbW9yeVwiLFxuICAgICAgICAgICAgICBzdG9yYWdlOiBcIjUxMkdCIFNTRFwiXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiBcIk5pa2UgQWlyIE1heCAyNzBcIixcbiAgICAgICAgICAgIGNhdGVnb3J5OiBcIkZvb3R3ZWFyXCIsXG4gICAgICAgICAgICBicmFuZDogXCJOaWtlXCIsXG4gICAgICAgICAgICBwcmljZTogMTUwLjAwLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQ29tZm9ydGFibGUgcnVubmluZyBzaG9lcyB3aXRoIGFpciBjdXNoaW9uaW5nXCIsXG4gICAgICAgICAgICBzcGVjaWZpY2F0aW9uczoge1xuICAgICAgICAgICAgICB3ZWlnaHQ6IFwiMC44IGtnXCIsXG4gICAgICAgICAgICAgIGNvbG9yOiBcIkJsYWNrL1doaXRlXCIsXG4gICAgICAgICAgICAgIG1hdGVyaWFsOiBcIk1lc2ggYW5kIHN5bnRoZXRpYyBsZWF0aGVyXCIsXG4gICAgICAgICAgICAgIHNvbGU6IFwiUnViYmVyIG91dHNvbGVcIixcbiAgICAgICAgICAgICAgdGVjaG5vbG9neTogXCJBaXIgTWF4IGN1c2hpb25pbmdcIlxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogXCJTYW1zdW5nIDU1LWluY2ggUUxFRCBUVlwiLFxuICAgICAgICAgICAgY2F0ZWdvcnk6IFwiRWxlY3Ryb25pY3NcIixcbiAgICAgICAgICAgIGJyYW5kOiBcIlNhbXN1bmdcIixcbiAgICAgICAgICAgIHByaWNlOiA4OTkuOTksXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCI0SyBTbWFydCBUViB3aXRoIHF1YW50dW0gZG90IHRlY2hub2xvZ3lcIixcbiAgICAgICAgICAgIHNwZWNpZmljYXRpb25zOiB7XG4gICAgICAgICAgICAgIHdlaWdodDogXCIxNy42IGtnXCIsXG4gICAgICAgICAgICAgIGRpbWVuc2lvbnM6IHsgd2lkdGg6IFwiMTIzLjEgY21cIiwgaGVpZ2h0OiBcIjcwLjcgY21cIiwgZGVwdGg6IFwiNS45IGNtXCIgfSxcbiAgICAgICAgICAgICAgcmVzb2x1dGlvbjogXCIzODQwIHggMjE2MFwiLFxuICAgICAgICAgICAgICBkaXNwbGF5OiBcIlFMRURcIixcbiAgICAgICAgICAgICAgc21hcnRQbGF0Zm9ybTogXCJUaXplbiBPU1wiLFxuICAgICAgICAgICAgICBjb25uZWN0aXZpdHk6IFtcIldpRmlcIiwgXCJCbHVldG9vdGhcIiwgXCJIRE1JXCIsIFwiVVNCXCJdXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiBcIk9yZ2FuaWMgQ290dG9uIFQtU2hpcnRcIixcbiAgICAgICAgICAgIGNhdGVnb3J5OiBcIkNsb3RoaW5nXCIsXG4gICAgICAgICAgICBicmFuZDogXCJFY29XZWFyXCIsXG4gICAgICAgICAgICBwcmljZTogMjkuOTksXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJTdXN0YWluYWJsZSBvcmdhbmljIGNvdHRvbiB0LXNoaXJ0XCIsXG4gICAgICAgICAgICBzcGVjaWZpY2F0aW9uczoge1xuICAgICAgICAgICAgICB3ZWlnaHQ6IFwiMC4yIGtnXCIsXG4gICAgICAgICAgICAgIG1hdGVyaWFsOiBcIjEwMCUgT3JnYW5pYyBDb3R0b25cIixcbiAgICAgICAgICAgICAgY29sb3I6IFwiTmF2eSBCbHVlXCIsXG4gICAgICAgICAgICAgIHNpemVzOiBbXCJYU1wiLCBcIlNcIiwgXCJNXCIsIFwiTFwiLCBcIlhMXCJdLFxuICAgICAgICAgICAgICBjYXJlOiBcIk1hY2hpbmUgd2FzaCBjb2xkXCIsXG4gICAgICAgICAgICAgIGNlcnRpZmljYXRpb246IFwiR09UUyBjZXJ0aWZpZWRcIlxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogXCJJbnN0YW50IFBvdCBEdW8gNy1pbi0xXCIsXG4gICAgICAgICAgICBjYXRlZ29yeTogXCJLaXRjaGVuXCIsXG4gICAgICAgICAgICBicmFuZDogXCJJbnN0YW50IFBvdFwiLFxuICAgICAgICAgICAgcHJpY2U6IDc5Ljk5LFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiTXVsdGktZnVuY3Rpb25hbCBlbGVjdHJpYyBwcmVzc3VyZSBjb29rZXJcIixcbiAgICAgICAgICAgIHNwZWNpZmljYXRpb25zOiB7XG4gICAgICAgICAgICAgIHdlaWdodDogXCI1LjQga2dcIixcbiAgICAgICAgICAgICAgZGltZW5zaW9uczogeyB3aWR0aDogXCIzMi41IGNtXCIsIGhlaWdodDogXCIzMS41IGNtXCIsIGRlcHRoOiBcIjMzIGNtXCIgfSxcbiAgICAgICAgICAgICAgY2FwYWNpdHk6IFwiNiBxdWFydHNcIixcbiAgICAgICAgICAgICAgZnVuY3Rpb25zOiBbXCJQcmVzc3VyZSBDb29rXCIsIFwiU2xvdyBDb29rXCIsIFwiUmljZSBDb29rZXJcIiwgXCJTdGVhbWVyXCIsIFwiU2F1dMOpXCIsIFwiWW9ndXJ0IE1ha2VyXCIsIFwiV2FybWVyXCJdLFxuICAgICAgICAgICAgICBtYXRlcmlhbDogXCJTdGFpbmxlc3Mgc3RlZWwgaW5uZXIgcG90XCIsXG4gICAgICAgICAgICAgIHNhZmV0eTogXCIxMCBzYWZldHkgbWVjaGFuaXNtc1wiXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICBdO1xuXG4gICAgICAgIGV4cG9ydHMuaGFuZGxlciA9IGFzeW5jIChldmVudCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXN1bHRzID0gW107XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGZvciAoY29uc3QgcHJvZHVjdCBvZiBzYW1wbGVQcm9kdWN0cykge1xuICAgICAgICAgICAgICBjb25zdCBwcm9kdWN0V2l0aElkID0ge1xuICAgICAgICAgICAgICAgIC4uLnByb2R1Y3QsXG4gICAgICAgICAgICAgICAgcHJvZHVjdElkOiBjcnlwdG8ucmFuZG9tVVVJRCgpLFxuICAgICAgICAgICAgICAgIGNyZWF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBjb25zdCBjb21tYW5kID0gbmV3IFB1dENvbW1hbmQoe1xuICAgICAgICAgICAgICAgIFRhYmxlTmFtZTogcHJvY2Vzcy5lbnYuVEFCTEVfTkFNRSxcbiAgICAgICAgICAgICAgICBJdGVtOiBwcm9kdWN0V2l0aElkXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgYXdhaXQgZG9jQ2xpZW50LnNlbmQoY29tbWFuZCk7XG4gICAgICAgICAgICAgIHJlc3VsdHMucHVzaChwcm9kdWN0V2l0aElkLnByb2R1Y3RJZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgICAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdTYW1wbGUgZGF0YSBwb3B1bGF0ZWQgc3VjY2Vzc2Z1bGx5JyxcbiAgICAgICAgICAgICAgICBwcm9kdWN0SWRzOiByZXN1bHRzXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdFcnJvcjonLCBlcnJvcik7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICBzdGF0dXNDb2RlOiA1MDAsXG4gICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdGYWlsZWQgdG8gcG9wdWxhdGUgc2FtcGxlIGRhdGEnIH0pXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgIGApLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgVEFCTEVfTkFNRTogcHJvZHVjdHNUYWJsZS50YWJsZU5hbWVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIEdyYW50IER5bmFtb0RCIHBlcm1pc3Npb25zIHRvIExhbWJkYSBmdW5jdGlvbnNcbiAgICBwcm9kdWN0c1RhYmxlLmdyYW50UmVhZERhdGEoZ2V0UHJvZHVjdHNGdW5jdGlvbik7XG4gICAgcHJvZHVjdHNUYWJsZS5ncmFudFJlYWREYXRhKGdldFByb2R1Y3RGdW5jdGlvbik7XG4gICAgcHJvZHVjdHNUYWJsZS5ncmFudFdyaXRlRGF0YShwb3B1bGF0ZURhdGFGdW5jdGlvbik7XG5cbiAgICAvLyBBUEkgR2F0ZXdheVxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ1Byb2R1Y3RzQXBpJywge1xuICAgICAgcmVzdEFwaU5hbWU6ICdQcm9kdWN0cyBBUEknLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgZm9yIGFjY2Vzc2luZyBwcm9kdWN0IHNwZWNpZmljYXRpb25zJyxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnWC1BbXotRGF0ZScsICdBdXRob3JpemF0aW9uJywgJ1gtQXBpLUtleSddXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSBpbnRlZ3JhdGlvbnNcbiAgICBjb25zdCBnZXRQcm9kdWN0c0ludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0UHJvZHVjdHNGdW5jdGlvbik7XG4gICAgY29uc3QgZ2V0UHJvZHVjdEludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oZ2V0UHJvZHVjdEZ1bmN0aW9uKTtcblxuICAgIC8vIEFQSSBHYXRld2F5IHJlc291cmNlcyBhbmQgbWV0aG9kc1xuICAgIGNvbnN0IHByb2R1Y3RzID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3Byb2R1Y3RzJyk7XG4gICAgcHJvZHVjdHMuYWRkTWV0aG9kKCdHRVQnLCBnZXRQcm9kdWN0c0ludGVncmF0aW9uKTtcblxuICAgIGNvbnN0IHByb2R1Y3QgPSBwcm9kdWN0cy5hZGRSZXNvdXJjZSgne2lkfScpO1xuICAgIHByb2R1Y3QuYWRkTWV0aG9kKCdHRVQnLCBnZXRQcm9kdWN0SW50ZWdyYXRpb24pO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlVcmwnLCB7XG4gICAgICB2YWx1ZTogYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgVVJMJ1xuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiBwcm9kdWN0c1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRHluYW1vREIgVGFibGUgTmFtZSdcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQb3B1bGF0ZURhdGFGdW5jdGlvbk5hbWUnLCB7XG4gICAgICB2YWx1ZTogcG9wdWxhdGVEYXRhRnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdGdW5jdGlvbiB0byBwb3B1bGF0ZSBzYW1wbGUgZGF0YSdcbiAgICB9KTtcbiAgfVxufVxuIl19