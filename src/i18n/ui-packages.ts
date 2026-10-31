import type { Dict } from "./lang";

export default {
  "error.packageProduct": () => "This installation does not sell that product.",
  "error.packageName": () => "Package names use up to 24 letters, digits, spaces, dashes and underscores.",
  "error.packageTaken": () => "A package with this name already exists.",
  "error.packageSpec": () => "Enter a CPU, RAM and disk size above zero.",
  "error.packageLimit": () => "An installation holds at most 12 packages.",
  "error.packageInUse": () => "Active accounts still use this package.",
  "error.packageMissing": () => "This package does not exist on the chosen host.",
  "error.packageTooSmall": () => "The package is too small for the ordered plan.",
  "error.username": () => "Usernames start with a letter and use lowercase letters and digits.",
  "error.usernameTaken": () => "This username is already taken.",
} satisfies Dict;
