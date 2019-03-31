import * as rp from "request-promise";
import { Card } from "./card";
import { Column } from "./column";

export class Board extends Object {
  token;
  id;
  name;
  columns: Column[];
  members: any[];
  labels: any[];
  cards: Card[];
  type = "board";
  loaded: boolean = false;
  constructor(
    token: string,
    name: string,
    id: string,
    columns: Column[],
    members: any[],
    labels: any[]
  ) {
    super();
    this.token = token;
    this.name = name;
    this.id = id;
    this.columns = columns;
    this.members = members;
    this.labels = labels;
  }

  static fromData(data: BoardData) {
    let { token, name, id, columns, members, labels } = data;
    return new Board(token, name, id, columns, members, labels);
  }

  static getBoard = async (token: string, boardId: string) => {
    try {
      let board = await rp({
        method: "GET",
        uri: `https://gloapi.gitkraken.com/v1/glo/boards/${boardId}/?fields=columns&fields=members&fields=name&access_token=${token}`
      }).then(result => {
        return JSON.parse(result) as BoardData;
      });
      let { name, id, columns, members, labels } = board;
      let col: Column[] = columns.map(e => {
        return new Column(token, e["name"], e["id"]);
      });
      return new Board(token, name, id, col, members, labels);
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  findColumnById = (columnId: string) => {
    let column: Column = this.columns.find(e => {
      return e.id === columnId;
    });
    return column;
  };

  findCardById = (cardId: string) => {
    let card: Card = this.cards.find(e => {
      return e.id === cardId;
    });
    return card;
  };

  getColumnsAsList = () => {
    let columns = this.columns;
    let element;
    let items = columns.reduce((obj, item) => {
      element = item;
      obj[item.id] = {
        title: `${element["name"]}`
      };
      return obj;
    }, {});
    return { items: items, element: element };
  };

  getCardsAsListByColumn = (columnId: string) => {
    let cards;
    cards = this.cards.filter(e => e.columnId === columnId);
    let element;
    let items = cards.reduce((obj, item) => {
      element = item;
      obj[item.id] = {
        title: `${element["name"]}`,
        description: `${element["updatedAt"].toDateString()}`
      };
      return obj;
    }, {});
    return { items: items, element: element };
  };

  getCardsAsList = () => {
    let cards = this.cards;
    let element;
    let items = cards.reduce((obj, item) => {
      element = item;
      obj[item.id] = {
        title: `${element["name"]}`,
        description: `${element["updatedAt"].toDateString()}`
      };
      return obj;
    }, {});
    return { items: items, element: element };
  };

  loadCards = async () => {
    console.log(
      `URL: https://gloapi.gitkraken.com/v1/glo/boards/${
        this.id
      }/cards?fields=assignees&fields=board_id&fields=column_id&fields=created_by&fields=created_date&fields=due_date&fields=description&fields=labels&fields=name&fields=updated_date&access_token=${
        this.token
      }`
    );
    let cards = await rp(
      `https://gloapi.gitkraken.com/v1/glo/boards/${
        this.id
      }/cards?fields=assignees&fields=board_id&fields=column_id&fields=created_by&fields=created_date&fields=due_date&fields=description&fields=labels&fields=name&fields=updated_date&access_token=${
        this.token
      }`
    )
      .then(result => {
        return JSON.parse(result) as any[];
      })
      .catch(error => {
        console.log(error);
      });
    this.loaded = true;
    this.cards = cards.map(e => {
      let {
        name,
        id,
        description,
        board_id,
        column_id,
        created_date,
        updated_date,
        assignees,
        labels,
        due_date,
        created_by
      } = e;

      assignees = assignees.map(assignee => {
        let member = this.members.find(i => {
          return assignee.id === i.id;
        });
        console.log(`Member ${JSON.stringify(member)}`);
        if (member) {
          return member;
        } else {
          return assignee;
        }
      });

      return new Card(
        this.token,
        name,
        id,
        description,
        board_id,
        column_id,
        created_date,
        updated_date,
        assignees,
        labels,
        due_date,
        created_by
      );
    });
  };

  createCard = async (
    cardName: string,
    columnId: string,
    cardDescription?: string
  ) => {
    try {
      console.log(`Description : ${cardDescription}`);
      let options = {
        method: "POST",
        uri: `https://gloapi.gitkraken.com/v1/glo/boards/${
          this.id
        }/cards?access_token=${this.token}`,
        body: JSON.stringify({
          name: cardName,
          column_id: columnId,
          description: { text: (cardDescription ? cardDescription : "") }
        }),
        headers: {
          "Content-Type": "application/json"
        }
      };
      console.log(options);
      return rp(options).then(result => {
        console.log(result);
        console.log(JSON.parse(result));
        
        let {
          name,
          id,
          description,
          board_id,
          column_id,
          created_date,
          updated_date,
          assignees,
          labels,
          due_date,
          created_by
        } = JSON.parse(result);
        let card: Card = new Card(
          this.token,
          name,
          id,
          description,
          board_id,
          column_id,
          created_date,
          updated_date,
          assignees,
          labels,
          due_date,
          created_by
        );

      
        console.log(`New created card: ${JSON.stringify(card)}`);
        return card;
      });
    } catch (error) {
      console.error(error);
    }
  };

  getContextData = () => {
    try {
      let snapshots = this.cards;
      return snapshots.reduce((obj, item) => {
        obj[item.id] = item;
        return obj;
      }, {});
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  createColumn = async (boardId: string, columnName: string) => {
    try {
      let options = {
        method: "POST",
        uri: `https://gloapi.gitkraken.com/v1/glo/boards/${boardId}/columns?access_token=${
          this.token
        }`,
        body: JSON.stringify({ name: columnName }),
        headers: {
          "Content-Type": "application/json"
        }
      };
      console.log(options);
      return rp(options).then(result => {
        console.log(result);
        console.log(JSON.parse(result));
        return null;
      });
    } catch (error) {
      console.error(error);
      return error;
    }
  };

  createBoard = async (boardName: string) => {
    try {
      let options = {
        method: "POST",
        uri: `https://gloapi.gitkraken.com/v1/glo/boards?access_token=${
          this.token
        }`,
        body: JSON.stringify({ name: boardName }),
        headers: {
          "Content-Type": "application/json"
        }
      };
      console.log(options);
      return rp(options).then(result => {
        console.log(result);
        console.log(JSON.parse(result));
        let { name, labels, members, columns, id } = JSON.parse(result);
        return new Board(this.token, name, id, columns, members, labels);
      });
    } catch (error) {
      console.error(error);
    }
  };
}

export interface BoardData {
  token: string;
  name: string;
  id: string;
  columns: Column[];
  members: any[];
  labels: any[];
}

module.exports = {
  Board
};
