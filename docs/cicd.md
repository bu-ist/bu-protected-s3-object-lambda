# Continuous integration/deployment (CI/CD)

Since [Github Actions](https://docs.github.com/actions) runs our CI/CD pipeline, a recommended refresher on CI/CD is the github ["CI/CD explained" article](https://resources.github.com/ci-cd/).
The implementation of this pipeline is a one-time exercise, with this as a record detailing what was done.

### Overview

A rudimentary [workflow](https://docs.github.com/en/actions/using-workflows/about-workflows#about-workflows) has been setup for deployment of the app that breaks down into the following sequence:

1. A feature branch is approved and merged into the main branch of the github repository for the app.
   This kicks off the [workflow](https://docs.github.com/en/actions/using-workflows/about-workflows#about-workflows).
2. A github action is configured to respond any new commit to the main branch by pulling the source, [building with SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-build.html), and [deploying with SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-deploy.html).

In order for github actions to authenticate and be granted access to perform these actions against the target aws account, one approach is to simply set the `aws_access_key_id, aws_secret_access_key, and aws_session_token` values of a sufficiently privileged IAM principal as [github secrets](https://github.com/bu-ist/bu-protected-s3-object-lambda/settings/secrets/actions) and then use those secrets as environment variables in the steps/jobs of the workflow.

To avoid the hassle of maintaining and rotating credentials, an alternative (and recommended) approach is taken that involves configuring AWS to trust GitHub's [OIDC](https://auth0.com/docs/authenticate/protocols/openid-connect-protocol#what-is-openid-connect-oidc-) as a [federated identity](https://aws.amazon.com/identity/federation/). Setting up for this approach can be found documented in both AWS and Github:

- AWS: [Use IAM roles to connect GitHub Actions to actions in AWS](https://aws.amazon.com/blogs/security/use-iam-roles-to-connect-github-actions-to-actions-in-aws/)
- Github: [Configuring OpenID Connect in Amazon Web Services](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)

> "*Have you ever wanted to initiate change in an [Amazon Web Services (AWS)](https://aws.amazon.com/) account after you update a GitHub repository, or deploy updates in an AWS application after you merge a commit, without the use of [AWS Identity and Access Management (IAM)](https://aws.amazon.com/iam/) user access keys? If you configure an [OpenID Connect (OIDC)](https://openid.net/connect/) identity provider (IdP) inside an AWS account, you can use IAM roles and short-term credentials, which removes the need for IAM user access keys.*"

### Steps

The abridged steps are:

1. Create an OIDC provider for GitHub.
   The location of the OIDC setup for production is [here](https://us-east-1.console.aws.amazon.com/iamv2/home?region=us-east-1#/identity_providers/details/OPENID/arn%3Aaws%3Aiam%3A%3A115619461932%3Aoidc-provider%2Ftoken.actions.githubusercontent.com)

2. Create an IAM role and scope the trust policy.
   The role "WordpressProtectedAssetsGithubActionsCloudformingRole" can be found [here](https://us-east-1.console.aws.amazon.com/iamv2/home?region=us-east-1#/roles/details/WordpressProtectedAssetsGithubActionsCloudformingRole?section=permissions)
   Role policy:

   ```
   {
       "Version": "2012-10-17",
       "Statement": [
           {
               "Effect": "Allow",
               "Action": "*",
               "Resource": "*"
           },
           {
               "Effect": "Deny",
               "Action": [
                   "iam:CreateServiceLinkedRole"
               ],
               "Resource": "*"
           },
           {
               "Effect": "Deny",
               "Action": [
                   "iam:PassRole"
               ],
               "NotResource": "arn:aws:iam::115619461932:role/wordpress-protected-s3-*"
           }
       ]
   }
   ```

   Trust relationship:

   ```
   {
       "Version": "2012-10-17",
       "Statement": [
           {
               "Effect": "Allow",
               "Principal": {
                   "Federated": "arn:aws:iam::115619461932:oidc-provider/token.actions.githubusercontent.com"
               },
               "Action": "sts:AssumeRoleWithWebIdentity",
               "Condition": {
                   "StringEquals": {
                       "token.actions.githubusercontent.com:sub": [
                           "repo:bu-ist/bu-protected-s3-object-lambda:ref:refs/heads/actions",
                           "repo:bu-ist/bu-protected-s3-object-lambda:ref:refs/heads/main"
                       ],
                       "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
                   }
               }
           }
       ]
   }
   ```

3. Create the github action (located in `.github/workflows/cicd.yml`)
   Below are relevant excerpts that shows the deploy job step that uses the role (`role-session-name`)

   ```
     env:
       AWS_REGION: us-east-1
     
     permissions: 
       id-token: write   # This is required for requesting the JWT
       contents: read    # This is required for actions/checkout
   
     ...
     
     jobs:
   	...
   	 deploy:
   	 ...
           - uses: aws-actions/configure-aws-credentials@v2
             with: 
               role-to-assume: arn:aws:iam::115619461932:role/WordpressProtectedAssetsGithubActionsCloudformingRole
               role-session-name: GitHub_to_AWS_via_FederatedOIDC
               aws-region: ${{ env.AWS_REGION }}
           - run: sam deploy --config-env prod
   ```

### Security

The trust relationship established for the role created above ensures that only the `token.actions.githubusercontent.com` provider can assume the role, and the authenticity of that provider is reinforced by the thumbprint associated with it.

OIDC (OpenID Connect) is an identity layer built on top of OAuth 2.0 that allows applications to securely verify the identity of an end-user. An OIDC thumbprint, also known as an OpenID Connect Provider (OP) thumbprint, is a cryptographic fingerprint of the public key used by the OIDC provider's token validation endpoint. It enhances security in OIDC-based authentication by helping to mitigate certain types of attacks:

1. **Man-in-the-Middle (MitM) Attacks:** In a MitM attack, an attacker intercepts and modifies communication between parties. By using a thumbprint, the relying party (client application) can verify that the OIDC provider's token validation endpoint hasn't been tampered with. This helps ensure that the authentication process isn't compromised by an attacker impersonating the OIDC provider.
2. **Token Validation Endpoint Integrity:** The thumbprint ensures that the public key used for validating OIDC tokens hasn't been swapped out with a different key. This safeguards the integrity of the token validation process and prevents unauthorized parties from providing forged tokens.
3. **Token Verification Assurance:** By including the OIDC thumbprint in the configuration of the relying party, the client application can be confident that the OIDC provider is indeed the trusted identity provider it claims to be. This reduces the risk of token-based attacks, such as the acceptance of tokens from unauthorized sources.
4. **Defense Against Key Exfiltration:** If an attacker gains access to the OIDC provider's private key used for token signing, they might try to insert their own public key into the provider's configuration. The OIDC thumbprint can help prevent such attacks by verifying that the public key used for token validation aligns with the trusted key.
5. **Third-Party OIDC Providers:** In scenarios where the relying party trusts multiple OIDC providers, the thumbprint can help ensure that tokens are only accepted from the intended and validated OIDC provider, preventing tokens from unauthorized providers.

In summary, the OIDC thumbprint is a security mechanism that enhances the trustworthiness of the OIDC authentication process by providing a means to verify the authenticity of the OIDC provider's token validation endpoint. It adds an additional layer of protection against various attack vectors, particularly those involving tampering, impersonation, and unauthorized token sources.