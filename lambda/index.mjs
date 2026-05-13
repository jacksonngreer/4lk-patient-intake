import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const dynamo = new DynamoDBClient({ region: "us-east-1" });
const s3 = new S3Client({ region: "us-east-1" });

const PRACTICE_ID = "bill-patton";
const TABLE_NAME = "PatientIntake";
const BUCKET_NAME = "4lk-patient-data";

export const handler = async (event) => {
  let body;
  try {
    body = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: "Invalid JSON body" }),
    };
  }

  const { visitType, patientFirstName, patientLastName, patientDOB, triage } = body ?? {};

  if (!visitType || !patientFirstName || !patientLastName || !patientDOB) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: false,
        error: "Missing required fields: visitType, patientFirstName, patientLastName, patientDOB",
      }),
    };
  }

  const submissionId = randomUUID();
  const submittedAt = new Date().toISOString();

  try {
    await dynamo.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          practiceId: { S: PRACTICE_ID },
          submissionId: { S: submissionId },
          visitType: { S: visitType },
          patientFirstName: { S: patientFirstName },
          patientLastName: { S: patientLastName },
          patientDOB: { S: patientDOB },
          triage: { S: triage ?? "Routine" },
          status: { S: "New" },
          submittedAt: { S: submittedAt },
        },
      })
    );

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `practices/${PRACTICE_ID}/patients/${submissionId}/intake.pdf`,
        Body: "placeholder",
        ContentType: "application/pdf",
      })
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, submissionId }),
    };
  } catch (err) {
    console.error("Error processing submission:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: "Internal server error" }),
    };
  }
};
