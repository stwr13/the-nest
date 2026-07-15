import { supabase } from "./supabase.js";
import { HOUSEHOLD } from "./config.js";

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const form = document.getElementById("login-form");
const errorBox = document.getElementById("login-error");
const submitBtn = document.getElementById("login-submit");
const userName = document.getElementById("user-name");

// Fires INITIAL_SESSION on page load, then again on every sign-in/out,
// so this is the single place that decides which view is showing.
supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    userName.textContent = HOUSEHOLD[session.user.email] ?? session.user.email;
  }
  loginView.hidden = Boolean(session);
  appView.hidden = !session;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(null);
  submitBtn.disabled = true;
  submitBtn.textContent = "Signing in…";

  const { error } = await supabase.auth.signInWithPassword({
    email: form.email.value.trim(),
    password: form.password.value,
  });

  submitBtn.disabled = false;
  submitBtn.textContent = "Sign in";
  if (error) showError(friendlyAuthError(error));
  else form.reset();
});

document.getElementById("sign-out").addEventListener("click", () => {
  supabase.auth.signOut();
});

function showError(message) {
  errorBox.textContent = message ?? "";
  errorBox.hidden = !message;
}

function friendlyAuthError(error) {
  if (error.message?.includes("Invalid login credentials")) {
    return "Wrong email or password — try again.";
  }
  if (error.message?.includes("fetch")) {
    return "No connection — couldn't sign in.";
  }
  return `Couldn't sign in: ${error.message}`;
}
