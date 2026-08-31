package entity

import (
	"encoding/json"
	"fmt"
)

type AvatarKind = string

const (
	AvatarKindPreset AvatarKind = "preset"
	AvatarKindCustom AvatarKind = "custom"
)

type PresetAvatarId = string

type PlayerAvatar interface {
	avatarKind()
}

type PresetAvatar struct {
	Kind AvatarKind     `json:"kind"`
	ID   PresetAvatarId `json:"id"`
}

func (PresetAvatar) avatarKind() {}

type CustomAvatar struct {
	Kind    AvatarKind `json:"kind"`
	DataURL string     `json:"dataUrl"`
}

func (CustomAvatar) avatarKind() {}

type PlayerAvatarData struct {
	Kind string      `json:"kind"`
	Data interface{} `json:"-"`
}

func (d PlayerAvatarData) ToPlayerAvatar() (PlayerAvatar, error) {
	switch d.Kind {
	case AvatarKindPreset:
		raw, err := json.Marshal(d.Data)
		if err != nil {
			return nil, err
		}
		var v PresetAvatar
		if err := json.Unmarshal(raw, &v); err != nil {
			return nil, err
		}
		return v, nil
	case AvatarKindCustom:
		raw, err := json.Marshal(d.Data)
		if err != nil {
			return nil, err
		}
		var v CustomAvatar
		if err := json.Unmarshal(raw, &v); err != nil {
			return nil, err
		}
		return v, nil
	default:
		return nil, fmt.Errorf("unknown PlayerAvatar kind: %q", d.Kind)
	}
}

func (d PlayerAvatarData) MarshalJSON() ([]byte, error) {
	if d.Kind == "" || d.Data == nil {
		return []byte("null"), nil
	}
	return json.Marshal(d.Data)
}

func (d *PlayerAvatarData) UnmarshalJSON(data []byte) error {
	if string(data) == "null" || string(data) == "" {
		d.Kind = ""
		d.Data = nil
		return nil
	}
	var raw struct {
		Kind AvatarKind `json:"kind"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	d.Kind = raw.Kind
	switch raw.Kind {
	case AvatarKindPreset:
		var v PresetAvatar
		if err := json.Unmarshal(data, &v); err != nil {
			return err
		}
		d.Data = v
	case AvatarKindCustom:
		var v CustomAvatar
		if err := json.Unmarshal(data, &v); err != nil {
			return err
		}
		d.Data = v
	default:
		d.Data = nil
	}
	return nil
}

func NewPresetAvatarData(id string) PlayerAvatarData {
	return PlayerAvatarData{Kind: AvatarKindPreset, Data: PresetAvatar{Kind: AvatarKindPreset, ID: id}}
}

func NewCustomAvatarData(dataURL string) PlayerAvatarData {
	return PlayerAvatarData{Kind: AvatarKindCustom, Data: CustomAvatar{Kind: AvatarKindCustom, DataURL: dataURL}}
}
