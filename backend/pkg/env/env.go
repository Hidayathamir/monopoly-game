package env

import "os"

// ParseEnvFlag returns true if value equals "true".
func ParseEnvFlag(value string) bool {
	return value == "true"
}

// GetEnvInt reads an int from the environment, returning fallback on failure.
func GetEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n := 0
	for _, c := range v {
		if c < '0' || c > '9' {
			return fallback
		}
		n = n*10 + int(c-'0')
	}
	return n
}

// GetEnvString reads a string from the environment, returning fallback if empty.
func GetEnvString(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
