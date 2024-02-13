const notFoundPage = '<html><body><h1>Not Found</h1></body></html>';

const forbiddenPage = '<html><body><h1>No Access</h1><p>You are not currently authorized to access this content.</p></body></html>';

function loginRedirectPage(shibHandler, returnUrl) {
  return `<html><body><h1>Log In</h1><p><a href="${shibHandler}/Login?target=${encodeURIComponent(returnUrl)}">Log in to see protected content</a></p></body></html>`;
}

export { notFoundPage, forbiddenPage, loginRedirectPage };
