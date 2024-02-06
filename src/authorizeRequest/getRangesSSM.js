import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function getRangesSSM() {
  // Create a new GetParameterCommand with the parameter name and decryption flag.
  const command = new GetParameterCommand({
    Name: process.env.RANGES_SSM_PARAMETER_NAME,
    WithDecryption: true,
  });

  // Get the ranges from SSM.
  const result = await ssmClient.send(command);

  // Destructure the Value from the result, and return it as a parsed JSON object.
  const { Parameter: { Value } } = result;
  return JSON.parse(Value);
}

export { getRangesSSM };
