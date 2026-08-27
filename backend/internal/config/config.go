package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	Port             int
	DistDir          string
	TradesEnabled    bool
	SeedEnabled      bool
	AFKTimeoutMs     int
	RoomEmptyGraceMs int
}

func Load() *Config {
	return &Config{
		Port:             getEnvInt("PORT", 3001),
		DistDir:          getEnvStr("DIST_DIR", "dist"),
		TradesEnabled:    getEnvBool("TRADES_ENABLED", true),
		SeedEnabled:      getEnvBool("E2E_SEED_ENABLED", false),
		AFKTimeoutMs:     getEnvInt("AFK_TIMEOUT_MS", 30000),
		RoomEmptyGraceMs: getEnvInt("ROOM_EMPTY_GRACE_MS", 30000),
	}
}

func getEnvStr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v := os.Getenv(key); v != "" {
		if strings.EqualFold(v, "true") {
			return true
		}
		if strings.EqualFold(v, "false") {
			return false
		}
	}
	return fallback
}
