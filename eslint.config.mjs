import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  // Keep Next + TS presets
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Project-wide config
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",             // make sure this is ignored
    ],
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],

      // 🔥 stop the empty-object errors from blocking builds
      "@typescript-eslint/no-empty-object-type": "warn",

      "@typescript-eslint/triple-slash-reference": "off",
      "react/no-unescaped-entities": "off",
    },
  },
];

export default eslintConfig;
