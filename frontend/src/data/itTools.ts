export interface ITTool {
  name: string;
  description: string;
  category: string;
  path: string;
  icon?: string;
}

// Map user provided categories to display names
const categoryMap: Record<string, string> = {
  'favorite-tools': 'Your favorite tools',
  'crypto': 'Crypto',
  'converter': 'Converter',
  'web': 'Web',
  'images and videos': 'Images & Videos',
  'development': 'Development',
  'network': 'Network',
  'math': 'Math',
  'measurement': 'Measurement',
  'text': 'Text',
  'data': 'Data'
};

// Helper to infer category based on tool functionality (since the user input list is flat but has a categories section)
// We will try to make a best guess based on keywords or default to 'Other' if not clear, 
// or ideally, we can group them if we had the mapping. 
// Given the user input structure, it lists categories first, then tools. 
// The tools themselves don't explicitly say which category they belong to in the YAML-like structure provided.
// However, I will try to categorize them logically based on their function to match the requested categories.

export const itTools: ITTool[] = [
  // Crypto
  {
    name: 'Password strength analyser',
    description: 'Discover the strength of your password with this client-side-only password strength analyser and crack time estimation tool.',
    category: 'Crypto',
    path: '/password-strength-analyser',
    icon: 'LockOutlined'
  },
  {
    name: 'Token generator',
    description: 'Generate random string with the chars you want, uppercase or lowercase letters, numbers and/or symbols.',
    category: 'Crypto',
    path: '/token-generator',
    icon: 'KeyOutlined'
  },
  {
    name: 'Bcrypt',
    description: 'Hash and compare text string using bcrypt. Bcrypt is a password-hashing function based on the Blowfish cipher.',
    category: 'Crypto',
    path: '/bcrypt',
    icon: 'SafetyCertificateOutlined'
  },
  {
    name: 'Encryption',
    description: 'Encrypt clear text and decrypt ciphertext using crypto algorithms like AES, TripleDES, Rabbit or RC4.',
    category: 'Crypto',
    path: '/encryption',
    icon: 'SafetyOutlined'
  },
  {
    name: 'Hmac generator',
    description: 'Computes a hash-based message authentication code (HMAC) using a secret key and your favorite hashing function.',
    category: 'Crypto',
    path: '/hmac-generator',
    icon: 'SafetyCertificateOutlined'
  },
  {
    name: 'BIP39 passphrase generator',
    description: 'Generate a BIP39 passphrase from an existing or random mnemonic, or get the mnemonic from the passphrase.',
    category: 'Crypto',
    path: '/bip39-generator',
    icon: 'WalletOutlined'
  },
  {
    name: 'Hash text',
    description: 'Hash a text string using the function you need : MD5, SHA1, SHA256, SHA224, SHA512, SHA384, SHA3 or RIPEMD160',
    category: 'Crypto',
    path: '/hash-text',
    icon: 'FieldNumberOutlined'
  },
  {
    name: 'UUIDs generator',
    description: 'A Universally Unique Identifier (UUID) is a 128-bit number used to identify information in computer systems.',
    category: 'Crypto',
    path: '/uuid-generator',
    icon: 'IdcardOutlined'
  },
  {
    name: 'RSA key pair generator',
    description: 'Generate a new random RSA private and public pem certificate key pair.',
    category: 'Crypto',
    path: '/rsa-key-pair-generator',
    icon: 'KeyOutlined'
  },
  {
    name: 'ULID generator',
    description: 'Generate random Universally Unique Lexicographically Sortable Identifier (ULID).',
    category: 'Crypto',
    path: '/ulid-generator',
    icon: 'IdcardOutlined'
  },
  {
    name: 'OTP code generator',
    description: 'Generate and validate time-based OTP (one time password) for multi-factor authentication.',
    category: 'Crypto',
    path: '/otp-generator',
    icon: 'SecurityScanOutlined'
  },

  // Converter
  {
    name: 'JSON to CSV',
    description: 'Convert JSON to CSV with automatic header detection.',
    category: 'Converter',
    path: '/json-to-csv',
    icon: 'FileExcelOutlined'
  },
  {
    name: 'Color converter',
    description: 'Convert color between the different formats (hex, rgb, hsl and css name)',
    category: 'Converter',
    path: '/color-converter',
    icon: 'BgColorsOutlined'
  },
  {
    name: 'Roman numeral converter',
    description: 'Convert Roman numerals to numbers and convert numbers to Roman numerals.',
    category: 'Converter',
    path: '/roman-numeral-converter',
    icon: 'TranslationOutlined'
  },
  {
    name: 'Base64 file converter',
    description: 'Convert a string, file, or image into its base64 representation.',
    category: 'Converter',
    path: '/base64-file-converter',
    icon: 'FileTextOutlined'
  },
  {
    name: 'Base64 string encoder/decoder',
    description: 'Simply encode and decode strings into their base64 representation.',
    category: 'Converter',
    path: '/base64-string-converter',
    icon: 'SwapOutlined'
  },
  {
    name: 'TOML to YAML',
    description: 'Parse and convert TOML to YAML.',
    category: 'Converter',
    path: '/toml-to-yaml',
    icon: 'FileSyncOutlined'
  },
  {
    name: 'JSON to YAML converter',
    description: 'Simply convert JSON to YAML with this online live converter.',
    category: 'Converter',
    path: '/json-to-yaml-converter',
    icon: 'FileSyncOutlined'
  },
  {
    name: 'Case converter',
    description: 'Transform the case of a string and choose between different formats',
    category: 'Converter',
    path: '/case-converter',
    icon: 'FontSizeOutlined'
  },
  {
    name: 'TOML to JSON',
    description: 'Parse and convert TOML to JSON.',
    category: 'Converter',
    path: '/toml-to-json',
    icon: 'FileSyncOutlined'
  },
  {
    name: 'Temperature converter',
    description: 'Degrees temperature conversions for Kelvin, Celsius, Fahrenheit, Rankine, Delisle, Newton, Réaumur, and Rømer.',
    category: 'Converter',
    path: '/temperature-converter',
    icon: 'DashboardOutlined'
  },
  {
    name: 'YAML to TOML',
    description: 'Parse and convert YAML to TOML.',
    category: 'Converter',
    path: '/yaml-to-toml',
    icon: 'FileSyncOutlined'
  },
  {
    name: 'Date-time converter',
    description: 'Convert date and time into the various different formats',
    category: 'Converter',
    path: '/date-converter',
    icon: 'CalendarOutlined'
  },
  {
    name: 'JSON to TOML',
    description: 'Parse and convert JSON to TOML.',
    category: 'Converter',
    path: '/json-to-toml',
    icon: 'FileSyncOutlined'
  },
  {
    name: 'Integer base converter',
    description: 'Convert a number between different bases (decimal, hexadecimal, binary, octal, base64, ...)',
    category: 'Converter',
    path: '/base-converter',
    icon: 'CalculatorOutlined'
  },
  {
    name: 'YAML to JSON converter',
    description: 'Simply convert YAML to JSON with this online live converter.',
    category: 'Converter',
    path: '/yaml-to-json-converter',
    icon: 'FileSyncOutlined'
  },
  {
    name: 'IPv4 address converter',
    description: 'Convert an IP address into decimal, binary, hexadecimal, or even an IPv6 representation of it.',
    category: 'Converter',
    path: '/ipv4-address-converter',
    icon: 'GlobalOutlined'
  },
  {
    name: 'Text to NATO alphabet',
    description: 'Transform text into the NATO phonetic alphabet for oral transmission.',
    category: 'Converter',
    path: '/text-to-nato-alphabet',
    icon: 'TranslationOutlined'
  },
  {
    name: 'Text to Unicode',
    description: 'Parse and convert text to unicode and vice-versa',
    category: 'Converter',
    path: '/text-to-unicode',
    icon: 'TranslationOutlined'
  },
  {
    name: 'Text to ASCII binary',
    description: 'Convert text to its ASCII binary representation and vice-versa.',
    category: 'Converter',
    path: '/text-to-binary',
    icon: 'CodeOutlined'
  },

  // Web
  {
    name: 'SVG placeholder generator',
    description: 'Generate svg images to use as a placeholder in your applications.',
    category: 'Web',
    path: '/svg-placeholder-generator',
    icon: 'PictureOutlined'
  },
  {
    name: 'Keycode info',
    description: 'Find the javascript keycode, code, location and modifiers of any pressed key.',
    category: 'Web',
    path: '/keycode-info',
    icon: 'EnterOutlined'
  },
  {
    name: 'Emoji picker',
    description: 'Copy and paste emojis easily and get the unicode and code points value of each emoji.',
    category: 'Web',
    path: '/emoji-picker',
    icon: 'SmileOutlined'
  },
  {
    name: 'HTTP status codes',
    description: 'The list of all HTTP status codes, their name, and their meaning.',
    category: 'Web',
    path: '/http-status-codes',
    icon: 'InfoCircleOutlined'
  },
  {
    name: 'Slugify string',
    description: 'Make a string url, filename and id safe.',
    category: 'Web',
    path: '/slugify-string',
    icon: 'LinkOutlined'
  },
  {
    name: 'URL parser',
    description: 'Parse a URL into its separate constituent parts (protocol, origin, params, port, username-password, ...)',
    category: 'Web',
    path: '/url-parser',
    icon: 'LinkOutlined'
  },
  {
    name: 'User-agent parser',
    description: 'Detect and parse Browser, Engine, OS, CPU, and Device type/model from an user-agent string.',
    category: 'Web',
    path: '/user-agent-parser',
    icon: 'DesktopOutlined'
  },
  {
    name: 'Escape HTML entities',
    description: 'Escape or unescape HTML entities (replace characters like <,>, &, " and \' with their HTML version)',
    category: 'Web',
    path: '/html-entities',
    icon: 'CodeOutlined'
  },
  {
    name: 'MIME types',
    description: 'Convert MIME types to file extensions and vice-versa.',
    category: 'Web',
    path: '/mime-types',
    icon: 'FileUnknownOutlined'
  },
  {
    name: 'QR Code generator',
    description: 'Generate and download a QR code for a URL (or just plain text), and customize the background and foreground colors.',
    category: 'Web',
    path: '/qrcode-generator',
    icon: 'QrcodeOutlined'
  },
  {
    name: 'WiFi QR Code generator',
    description: 'Generate and download QR codes for quick connections to WiFi networks.',
    category: 'Web',
    path: '/wifi-qrcode-generator',
    icon: 'WifiOutlined'
  },
  {
    name: 'HTML WYSIWYG editor',
    description: 'Online, feature-rich WYSIWYG HTML editor which generates the source code of the content immediately.',
    category: 'Web',
    path: '/html-wysiwyg-editor',
    icon: 'EditOutlined'
  },
  {
    name: 'JWT parser',
    description: 'Parse and decode your JSON Web Token (jwt) and display its content.',
    category: 'Web',
    path: '/jwt-parser',
    icon: 'SafetyCertificateOutlined'
  },
  {
    name: 'Open graph meta generator',
    description: 'Generate open-graph and socials HTML meta tags for your website.',
    category: 'Web',
    path: '/og-meta-generator',
    icon: 'ShareAltOutlined'
  },
  {
    name: 'Device information',
    description: 'Get information about your current device (screen size, pixel-ratio, user agent, ...)',
    category: 'Web',
    path: '/device-information',
    icon: 'MobileOutlined'
  },
  {
    name: 'Basic auth generator',
    description: 'Generate a base64 basic auth header from a username and password.',
    category: 'Web',
    path: '/basic-auth-generator',
    icon: 'LockOutlined'
  },
  {
    name: 'Encode/decode URL-formatted strings',
    description: 'Encode text to URL-encoded format (also known as "percent-encoded"), or decode from it.',
    category: 'Web',
    path: '/url-encoder',
    icon: 'LinkOutlined'
  },

  // Development
  {
    name: 'Crontab generator',
    description: 'Validate and generate crontab and get the human-readable description of the cron schedule.',
    category: 'Development',
    path: '/crontab-generator',
    icon: 'ClockCircleOutlined'
  },
  {
    name: 'SQL prettify and format',
    description: 'Format and prettify your SQL queries online (it supports various SQL dialects).',
    category: 'Development',
    path: '/sql-prettify',
    icon: 'DatabaseOutlined'
  },
  {
    name: 'Benchmark builder',
    description: 'Easily compare execution time of tasks with this very simple online benchmark builder.',
    category: 'Development',
    path: '/benchmark-builder',
    icon: 'DashboardOutlined'
  },
  {
    name: 'Git cheatsheet',
    description: 'Git is a decentralized version management software. With this cheatsheet, you will have quick access to the most common git commands.',
    category: 'Development',
    path: '/git-memo',
    icon: 'BranchesOutlined'
  },
  {
    name: 'Random port generator',
    description: 'Generate random port numbers outside of the range of "known" ports (0-1023).',
    category: 'Development',
    path: '/random-port-generator',
    icon: 'NumberOutlined'
  },
  {
    name: 'YAML prettify and format',
    description: 'Prettify your YAML string into a friendly, human-readable format.',
    category: 'Development',
    path: '/yaml-prettify',
    icon: 'AlignLeftOutlined'
  },
  {
    name: 'JSON prettify and format',
    description: 'Prettify your JSON string into a friendly, human-readable format.',
    category: 'Development',
    path: '/json-prettify',
    icon: 'AlignLeftOutlined'
  },
  {
    name: 'Docker run to Docker compose converter',
    description: 'Transforms "docker run" commands into docker-compose files!',
    category: 'Development',
    path: '/docker-run-to-docker-compose-converter',
    icon: 'ContainerOutlined'
  },
  {
    name: 'XML formatter',
    description: 'Prettify your XML string into a friendly, human-readable format.',
    category: 'Development',
    path: '/xml-formatter',
    icon: 'CodeOutlined'
  },
  {
    name: 'Chmod calculator',
    description: 'Compute your chmod permissions and commands with this online chmod calculator.',
    category: 'Development',
    path: '/chmod-calculator',
    icon: 'CalculatorOutlined'
  },
  {
    name: 'JSON diff',
    description: 'Compare two JSON objects and get the differences between them.',
    category: 'Development',
    path: '/json-diff',
    icon: 'DiffOutlined'
  },
  {
    name: 'JSON minify',
    description: 'Minify and compress your JSON by removing unnecessary whitespace.',
    category: 'Development',
    path: '/json-minify',
    icon: 'CompressOutlined'
  },

  // Network
  {
    name: 'IBAN validator and parser',
    description: 'Validate and parse IBAN numbers. Check if an IBAN is valid and get the country, BBAN, if it is a QR-IBAN and the IBAN friendly format.',
    category: 'Network',
    path: '/iban-validator-and-parser',
    icon: 'BankOutlined'
  },
  {
    name: 'MAC address lookup',
    description: 'Find the vendor and manufacturer of a device by its MAC address.',
    category: 'Network',
    path: '/mac-address-lookup',
    icon: 'SearchOutlined'
  },
  {
    name: 'MAC address generator',
    description: 'Enter the quantity and prefix. MAC addresses will be generated in your chosen case (uppercase or lowercase)',
    category: 'Network',
    path: '/mac-address-generator',
    icon: 'SettingOutlined'
  },
  {
    name: 'IPv4 subnet calculator',
    description: 'Parse your IPv4 CIDR blocks and get all the info you need about your subnet.',
    category: 'Network',
    path: '/ipv4-subnet-calculator',
    icon: 'ClusterOutlined'
  },
  {
    name: 'IPv6 ULA generator',
    description: 'Generate your own local, non-routable IP addresses for your network according to RFC4193.',
    category: 'Network',
    path: '/ipv6-ula-generator',
    icon: 'GlobalOutlined'
  },
  {
    name: 'IPv4 range expander',
    description: 'Given a start and an end IPv4 address, this tool calculates a valid IPv4 subnet along with its CIDR notation.',
    category: 'Network',
    path: '/ipv4-range-expander',
    icon: 'GatewayOutlined'
  },

  // Math
  {
    name: 'Chronometer',
    description: 'Monitor the duration of a thing. Basically a chronometer with simple chronometer features.',
    category: 'Math',
    path: '/chronometer',
    icon: 'FieldTimeOutlined'
  },
  {
    name: 'Percentage calculator',
    description: 'Easily calculate percentages from a value to another value, or from a percentage to a value.',
    category: 'Math',
    path: '/percentage-calculator',
    icon: 'PercentageOutlined'
  },
  {
    name: 'ETA calculator',
    description: 'An ETA (Estimated Time of Arrival) calculator to determine the approximate end time of a task, for example, the end time and duration of a file download.',
    category: 'Math',
    path: '/eta-calculator',
    icon: 'HourglassOutlined'
  },
  {
    name: 'Math evaluator',
    description: 'A calculator for evaluating mathematical expressions. You can use functions like sqrt, cos, sin, abs, etc.',
    category: 'Math',
    path: '/math-evaluator',
    icon: 'CalculatorOutlined'
  },

  // Text
  {
    name: 'List converter',
    description: 'This tool can process column-based data and apply various changes (transpose, add prefix and suffix, reverse list, sort list, lowercase values, truncate values) to each row.',
    category: 'Text',
    path: '/list-converter',
    icon: 'OrderedListOutlined'
  },
  {
    name: 'Numeronym generator',
    description: 'A numeronym is a word where a number is used to form an abbreviation. For example, "i18n" is a numeronym of "internationalization" where 18 stands for the number of letters between the first i and the last n in the word.',
    category: 'Text',
    path: '/numeronym-generator',
    icon: 'FontSizeOutlined'
  },
  {
    name: 'Lorem ipsum generator',
    description: 'Lorem ipsum is a placeholder text commonly used to demonstrate the visual form of a document or a typeface without relying on meaningful content',
    category: 'Text',
    path: '/lorem-ipsum-generator',
    icon: 'FileTextOutlined'
  },
  {
    name: 'String obfuscator',
    description: 'Obfuscate a string (like a secret, an IBAN, or a token) to make it shareable and identifiable without revealing its content.',
    category: 'Text',
    path: '/string-obfuscator',
    icon: 'EyeInvisibleOutlined'
  },
  {
    name: 'Text statistics',
    description: 'Get information about a text, the number of characters, the number of words, its size in bytes, ...',
    category: 'Text',
    path: '/text-statistics',
    icon: 'BarChartOutlined'
  },
  {
    name: 'Text diff',
    description: 'Compare two texts and see the differences between them.',
    category: 'Text',
    path: '/text-diff',
    icon: 'DiffOutlined'
  },

  // Data
  {
    name: 'Phone parser and formatter',
    description: 'Parse, validate and format phone numbers. Get information about the phone number, like the country code, type, etc.',
    category: 'Data',
    path: '/phone-parser-and-formatter',
    icon: 'PhoneOutlined'
  },
  {
    name: 'PDF signature checker',
    description: 'Verify the signatures of a PDF file. A signed PDF file contains one or more signatures that may be used to determine whether the contents of the file have been altered since the file was signed.',
    category: 'Data',
    path: '/pdf-signature-checker',
    icon: 'FilePdfOutlined'
  },

  // Images & Videos (Mapped from 'images and videos')
  {
    name: 'Camera recorder',
    description: 'Take a picture or record a video from your webcam or camera.',
    category: 'Images & Videos',
    path: '/camera-recorder',
    icon: 'VideoCameraOutlined'
  }
];

export const categories = Array.from(new Set(itTools.map(t => t.category)));
