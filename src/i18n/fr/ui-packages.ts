import type { Dict } from "../lang";

export default {
  "error.packageProduct": () => "Cette installation ne vend pas ce produit.",
  "error.packageName": () => "Les noms de package comptent jusqu'à 24 lettres, chiffres, espaces, tirets et tirets bas.",
  "error.packageTaken": () => "Un package de ce nom existe déjà.",
  "error.packageSpec": () => "Indiquez une taille de CPU, de RAM et de disque supérieure à zéro.",
  "error.packageLimit": () => "Une installation contient au plus 12 packages.",
  "error.packageInUse": () => "Des comptes actifs utilisent encore ce package.",
  "error.packageMissing": () => "Ce package n'existe pas sur l'hôte choisi.",
  "error.packageTooSmall": () => "Le package est trop petit pour l'offre commandée.",
  "error.username": () => "Les noms d'utilisateur commencent par une lettre et utilisent des minuscules et des chiffres.",
  "error.usernameTaken": () => "Ce nom d'utilisateur est déjà pris.",
} satisfies Dict;
