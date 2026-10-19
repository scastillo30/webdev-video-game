package store

import (
 "database/sql"
 "embed"
 "errors"
 "time"
 _ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrations embed.FS

type Character struct { ID string `json:"id"`; Name string `json:"name"`; Role string `json:"role"`; Epithet string `json:"epithet"`; Bio string `json:"bio"`; Accent string `json:"accent"`; AnimationPath string `json:"animationPath"`; PosterPath string `json:"posterPath"`; ThumbPath string `json:"thumbPath"`; CommentThumbPath string `json:"commentThumbPath"` }
type Store struct{ db *sql.DB }

func Open(path string)(*Store,error){db,err:=sql.Open("sqlite",path);if err!=nil{return nil,err};db.SetMaxOpenConns(1);if _,err=db.Exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");err!=nil{return nil,err};migration,err:=migrations.ReadFile("migrations/001_characters.sql");if err!=nil{return nil,err};if _,err=db.Exec(string(migration));err!=nil{return nil,err};return &Store{db:db},nil}
func(s *Store)Close()error{return s.db.Close()}
const fields="id,name,role,epithet,bio,accent,animation_path,poster_path,thumb_path,comment_thumb_path"
func scan(scanner interface{Scan(...any)error})(Character,error){var c Character;err:=scanner.Scan(&c.ID,&c.Name,&c.Role,&c.Epithet,&c.Bio,&c.Accent,&c.AnimationPath,&c.PosterPath,&c.ThumbPath,&c.CommentThumbPath);return c,err}
func(s *Store)List()([]Character,error){rows,err:=s.db.Query("SELECT "+fields+" FROM characters ORDER BY name");if err!=nil{return nil,err};defer rows.Close();out:=[]Character{};for rows.Next(){c,err:=scan(rows);if err!=nil{return nil,err};out=append(out,c)};return out,rows.Err()}
func(s *Store)Get(id string)(Character,error){return scan(s.db.QueryRow("SELECT "+fields+" FROM characters WHERE id=?",id))}
func(s *Store)Create(c Character)(Character,error){if c.ID==""||c.Name==""||c.Role==""{return c,errors.New("id, name and role are required")};_,err:=s.db.Exec("INSERT INTO characters(id,name,role,epithet,bio,accent,animation_path,poster_path,thumb_path,comment_thumb_path) VALUES(?,?,?,?,?,?,?,?,?,?)",c.ID,c.Name,c.Role,c.Epithet,c.Bio,c.Accent,c.AnimationPath,c.PosterPath,c.ThumbPath,c.CommentThumbPath);return c,err}
func(s *Store)Update(id string,c Character)(Character,error){c.ID=id;result,err:=s.db.Exec("UPDATE characters SET name=?,role=?,epithet=?,bio=?,accent=?,animation_path=?,poster_path=?,thumb_path=?,comment_thumb_path=?,updated_at=? WHERE id=?",c.Name,c.Role,c.Epithet,c.Bio,c.Accent,c.AnimationPath,c.PosterPath,c.ThumbPath,c.CommentThumbPath,time.Now().UTC().Format(time.RFC3339),id);if err!=nil{return c,err};n,_:=result.RowsAffected();if n==0{return c,sql.ErrNoRows};return c,nil}
func(s *Store)Delete(id string)error{result,err:=s.db.Exec("DELETE FROM characters WHERE id=?",id);if err!=nil{return err};n,_:=result.RowsAffected();if n==0{return sql.ErrNoRows};return nil}
