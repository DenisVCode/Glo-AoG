import * as rp from "request-promise";
import {Board} from './board';
import { Column } from "./column";

export class Boards extends Array{
    boards: Array<Board>;
    token;
    length: number;
    type = 'boards';
    constructor(token: string, boards?) {
        super();
        this.token = token;
        if(boards) {
            this.boards = boards;
        }
    }

    isUndefined = () => {
        return this.boards ? false : true;
    }

    getBoardsArray = () => {
        return this.boards;
    }

    getBoard = (boardId: string) => {
        console.log(`Find in: ${JSON.stringify(this.boards)}`);
        console.log(`Looking for: ${boardId}`);
        if(this.boards instanceof Array) {
          let boardFound = this.boards.find(e => {
            return e.id === boardId;
          })
          if(boardFound) {
            return boardFound;
          } else {
            return null;
          }
        } else {
          let boardFound = this.boards[boardId];
          let {name, id, columns, members, labels} = boardFound;
          try {
              return new Board(this.token, name, id, columns, members, labels);
          } catch (error) {
              console.error(error);
              return null;
          }
        }
       
    }

    getContextData = () => {
        try {
            let snapshots = this.boards;
            return snapshots.reduce((obj, item) => {
                obj[item.id] = item;
                return obj;
              }, {});
        } catch (error) {
            console.error(error);
            return null;
        }
    }
    getListFormat = () => {
        try {
            let snapshots = this.boards;
            let element;
            let items = snapshots.reduce((obj, item) => {
              element = item;
              let columnsText: string;
              console.log(item.columns);
              if(item.columns) {
                let columnsNames = item.columns.map((column) => {
                  console.log(`Column: ${JSON.stringify(column)}`);
                  return column.name;
                })
                columnsText = columnsNames.join(', ');
              }
              obj[item.id] = {
                title: `${element["name"]}`,
                description: `${columnsText ? columnsText : `No columns`}`
              };
              return obj;
            }, {});
            return {
              items: items,
              element: element
            };
          } catch (error) {
            console.error(error);
            return {
              listOfBoards: error,
              element: error
            };
          }
    }

    loadAllCards = async () => {
      try {
        let boards: Board[] = [];
        for(let board of this.boards) {
          await board.loadCards();
          console.log(`Board: ${JSON.stringify(board)}`);
          boards.push(board);
        }
        this.boards = boards;
        console.log('First board cards: ' + JSON.stringify(this.boards));
        return;
      } catch (error) {
        console.error(error);
        return error;
      }
    }

    getBoards = async () => {
        try {
          let boards = await rp({ method: 'GET', uri:`https://gloapi.gitkraken.com/v1/glo/boards?fields=columns&fields=members&fields=name&access_token=${this.token}`
          }).then(result => {
            return JSON.parse(result) as any[];
          });
          
          this.boards = boards.map(i => {
            let {name, id, columns, members, labels} = i;
            let col: Column[] = columns.map(e => {
                return new Column(this.token, e['name'], e['id']);
            })
            return new Board(this.token, name, id, col, members, labels)
          });
          this.length = this.boards.length;
        } catch (error) {
          console.error(error);
        }
      };
}


module.exports = {
    Boards,
}