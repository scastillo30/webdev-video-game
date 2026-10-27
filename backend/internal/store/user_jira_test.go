package store

import (
	"context"
	"path/filepath"
	"testing"
)

func TestMatchEmployeeRules(t *testing.T) {
	database, err := Open(filepath.Join(t.TempDir(), "game.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	character, err := database.Get("commander")
	if err != nil {
		t.Fatal(err)
	}
	character.Name = "Jane Doe"
	workEmail, login := "jdoe@example.test", "architect.jane"
	character.WorkEmail, character.LinkedLogin = &workEmail, &login
	if _, err = database.Update(character.ID, character); err != nil {
		t.Fatal(err)
	}
	for _, input := range [][2]string{{"  JANE   DOE ", ""}, {"", "jdoe"}, {"", "jane.doe"}, {"", "ARCHITECT.JANE"}} {
		matched, matchErr := database.MatchEmployee(context.Background(), input[0], input[1])
		if matchErr != nil || matched == nil || matched.ID != "commander" {
			t.Fatalf("input %#v did not match commander: matched=%#v err=%v", input, matched, matchErr)
		}
	}
	matched, err := database.MatchEmployee(context.Background(), "Unknown Person", "unknown")
	if err != nil || matched != nil {
		t.Fatalf("unexpected unknown match: matched=%#v err=%v", matched, err)
	}
}
