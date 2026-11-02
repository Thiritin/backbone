import type { Dict } from "./lang";

// Headline features of each SquirrelMeal and Postfixit Admin release, joined by "|".
export default {
  "swnews.squirrelmeal.1.4.4": () => "Security fixes for the compose page|Better handling of broken MIME mail|Translation updates",
  "swnews.squirrelmeal.1.5.1": () => "Development snapshot of the 1.5 line|New icons in the folder list|Templates for the page layout",
  "swnews.squirrelmeal.1.4.5": () => "Fixes for cross-site scripting holes|Faster folder list|PHP 5 compatibility",
  "swnews.squirrelmeal.1.4.6": () => "Security fixes in the address book|Better IMAP error messages|Translation updates",
  "swnews.squirrelmeal.1.4.10": () => "Security fixes for HTML mail|Folder sorting fixes|Better PHP 5.2 support",
  "swnews.squirrelmeal.1.4.13": () => "The 1.4.11 and 1.4.12 downloads were replaced by tampered copies after a break-in on the download server|Reinstall from this release and check your files|Security fixes",
  "swnews.squirrelmeal.1.4.15": () => "Security fixes|Better UTF-8 handling|Fixes for the session handling",
  "swnews.squirrelmeal.1.4.16": () => "Fix for a session cookie leak over plain HTTP|Translation updates|Minor fixes",
  "swnews.squirrelmeal.1.4.17": () => "Security fixes for cross-site scripting|Better HTML filter|Minor fixes",
  "swnews.squirrelmeal.1.4.19": () => "Security fixes for the map_yp_alias function|Fixes for message display|Translation updates",
  "swnews.squirrelmeal.1.4.20": () => "PHP 5.3 support|Security fixes|Minor fixes",
  "swnews.squirrelmeal.1.4.21": () => "Fixes for the login with long passwords|Security fixes|Minor fixes",
  "swnews.squirrelmeal.1.4.22": () => "The last numbered release|Security fixes for HTML mail|Better clickjacking protection",
  "swnews.squirrelmeal.1.4.23": () => "Snapshot for PHP 5.4 and 5.5|Security fixes|Updated HTML filter",
  "swnews.squirrelmeal.1.4.23 (2021)": () => "Snapshot that runs on PHP 8|Security fixes|Updated translations",
  "swnews.squirrelmeal.1.5.2": () => "Development snapshot for PHP 8|New template set|Updated plugins",
  "swnews.postfixitadmin.2.1": () => "Virtual domains, mailboxes and aliases|Domain admins|Out-of-office replies",
  "swnews.postfixitadmin.2.2": () => "Fetch mail from other accounts|Better password encryption|Translation updates",
  "swnews.postfixitadmin.2.3": () => "Alias domains|Command line interface|Dovecoat password schemes",
  "swnews.postfixitadmin.3.0": () => "New Bootstrap-based look|PHP 7 support|Safer setup password",
  "swnews.postfixitadmin.3.2": () => "Two-step setup|Better quota display|PHP 7.2 support",
  "swnews.postfixitadmin.3.3": () => "PHP 8 support|Password expiry|Security fixes",
} satisfies Dict;
