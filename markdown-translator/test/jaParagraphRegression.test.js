import test from "node:test";
import assert from "node:assert/strict";

import {
  createLinkPlaceholderHtml,
  restorePreservedPlaceholders,
} from "../src/placeholderUtils.js";

const restorePlaceholders = (text, meta) =>
  text.replace(/\{\{B-PLACEHOLDER-(\d+)-PLACEHOLDER-E\}\}/g, (_, idx) => {
    return meta[idx]?.node?.value ?? "";
  });

test("Japanese paragraph placeholder flow preserves CustomContent and removes duplicated link text", () => {
  const htmlSentToGoogle =
    `${createLinkPlaceholderHtml(
      0,
      "https://www.pingcap.com/tidb-cloud/",
      "TiDB Cloud"
    )} is a fully managed, cloud-native Database-as-a-Service (DBaaS) based on ${createLinkPlaceholderHtml(
      1,
      "https://docs.pingcap.com/tidb/stable/overview",
      "TiDB"
    )}, an open-source Hybrid Transactional and Analytical Processing (HTAP) database. TiDB Cloud offers an easy way to deploy and manage databases to let you focus on your applications, not the complexities of the databases. <span translate="no">2</span>You can create TiDB Cloud clusters to quickly build mission-critical applications on Amazon Web Services (AWS), Google Cloud, Microsoft Azure, and Alibaba Cloud.<span translate="no">3</span><span translate="no">4</span>You can create TiDB Cloud clusters to quickly build mission-critical applications on Amazon Web Services (AWS), Google Cloud, and Microsoft Azure.<span translate="no">5</span>`;

  const googleReturnedHtml =
    `${createLinkPlaceholderHtml(
      0,
      "https://www.pingcap.com/tidb-cloud/",
      "TiDB Cloud"
    )}は、オープンソースのハイブリッドトランザクションおよび分析処理 (HTAP) データベースである ${createLinkPlaceholderHtml(
      1,
      "https://docs.pingcap.com/tidb/stable/overview",
      "TiDB"
    )}をベースにした、フルマネージド型のクラウドネイティブなデータベース・アズ・ア・サービス (DBaaS) です。TiDB Cloud は、データベースのデプロイと管理を容易にし、データベースの複雑さではなく、アプリケーションの開発に集中できるようにします。<span translate="no">2</span>TiDB Cloudクラスターを作成することで、Amazon Web Services（AWS）、Google Cloud、Microsoft Azure、およびAlibaba Cloud上にミッションクリティカルなアプリケーションを迅速に構築できます。<span translate="no">3</span><span translate="no">4</span>TiDB Cloudクラスターを作成することで、Amazon Web Services（AWS）、Google Cloud、Microsoft Azure上にミッションクリティカルなアプリケーションを迅速に構築できます。<span translate="no">5</span>`;

  const meta = {
    0: {
      kind: "link",
      node: {
        value: "[TiDB Cloud](https://www.pingcap.com/tidb-cloud/)",
      },
    },
    1: {
      kind: "link",
      node: {
        value: "[TiDB](https://docs.pingcap.com/tidb/stable/overview)",
      },
    },
    2: {
      kind: "node",
      node: {
        value: '<CustomContent language="en,zh">',
      },
    },
    3: {
      kind: "node",
      node: {
        value: "</CustomContent>",
      },
    },
    4: {
      kind: "node",
      node: {
        value: '<CustomContent language="ja">',
      },
    },
    5: {
      kind: "node",
      node: {
        value: "</CustomContent>",
      },
    },
  };

  assert.match(htmlSentToGoogle, /data-docs-link-placeholder="0"/);
  assert.match(htmlSentToGoogle, /data-docs-link-placeholder="1"/);
  assert.match(htmlSentToGoogle, /<span translate="no">2<\/span>/);
  assert.match(htmlSentToGoogle, /<span translate="no">5<\/span>/);

  const translatedWithPlaceholders = restorePreservedPlaceholders(googleReturnedHtml);
  const restored = restorePlaceholders(translatedWithPlaceholders, meta);

  assert.equal(
    restored,
    '[TiDB Cloud](https://www.pingcap.com/tidb-cloud/)は、オープンソースのハイブリッドトランザクションおよび分析処理 (HTAP) データベースである [TiDB](https://docs.pingcap.com/tidb/stable/overview)をベースにした、フルマネージド型のクラウドネイティブなデータベース・アズ・ア・サービス (DBaaS) です。TiDB Cloud は、データベースのデプロイと管理を容易にし、データベースの複雑さではなく、アプリケーションの開発に集中できるようにします。<CustomContent language="en,zh">TiDB Cloudクラスターを作成することで、Amazon Web Services（AWS）、Google Cloud、Microsoft Azure、およびAlibaba Cloud上にミッションクリティカルなアプリケーションを迅速に構築できます。</CustomContent><CustomContent language="ja">TiDB Cloudクラスターを作成することで、Amazon Web Services（AWS）、Google Cloud、Microsoft Azure上にミッションクリティカルなアプリケーションを迅速に構築できます。</CustomContent>'
  );
});
