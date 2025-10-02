import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';

export class CdkAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
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
