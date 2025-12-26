import { useEffect } from "react";

import { useAuth } from "../auth/AuthContext";

export function GoogleLoginButton() {
  const { login } = useAuth();

  useEffect(() => {
    initGoogleLogin(login);

    // @ts-ignore
    google.accounts.id.renderButton(document.getElementById("googleBtn"), {
      theme: "outline",
      size: "large",
    });
  }, []);

  return <div id="googleBtn"></div>;
}
