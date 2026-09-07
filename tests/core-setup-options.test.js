// setup(names, options) のオプション正規化の回帰テスト。
//
// 旧実装は `this.interpolation = options.interpolation` をそのまま代入していたため、
// setup(names, {}) で this.interpolation が undefined になり、直後の
// `.max_consecutive_missing` 参照で TypeError になっていた。既定値とマージして常に
// { enabled, max_consecutive_missing } の形に正規化する。線形補間そのものは未実装（予約オプション）。

const assert = require('node:assert/strict');
const { loadOrphe } = require('./helpers/orphe-core-vm');

const { Orphe } = loadOrphe();
const DEFAULT_NAMES = ['DEVICE_INFORMATION', 'DATE_TIME', 'SENSOR_VALUES', 'STEP_ANALYSIS'];

function make() {
  const core = new Orphe(0);
  return core;
}

// vm コンテキスト内で作られたオブジェクトは Object.prototype が別 realm なので、
// deepStrictEqual の前にテスト側 realm のプレーンオブジェクトへコピーする。
const plain = (obj) => ({ ...obj });

// 4 つの呼び出し形が例外を投げず、interpolation が正規化される
{
  const core = make();
  assert.doesNotThrow(() => core.setup(), 'setup() must not throw');
  assert.deepEqual(plain(core.interpolation), { enabled: false, max_consecutive_missing: 1 }, 'setup(): defaults');
  for (const name of DEFAULT_NAMES) assert.ok(core.hashUUID[name], `setup() registers ${name}`);
}
{
  const core = make();
  assert.doesNotThrow(() => core.setup(['DEVICE_INFORMATION', 'SENSOR_VALUES']), 'setup(names) must not throw');
  assert.deepEqual(plain(core.interpolation), { enabled: false, max_consecutive_missing: 1 }, 'setup(names): defaults');
  assert.ok(core.hashUUID.SENSOR_VALUES);
  assert.equal(core.hashUUID.STEP_ANALYSIS, undefined, 'setup(names) only registers the given names');
}
{
  const core = make();
  assert.doesNotThrow(() => core.setup(DEFAULT_NAMES, {}), 'setup(names, {}) must not throw (was TypeError)');
  assert.deepEqual(plain(core.interpolation), { enabled: false, max_consecutive_missing: 1 }, 'setup(names, {}): defaults');
}
{
  const core = make();
  assert.doesNotThrow(
    () => core.setup(DEFAULT_NAMES, { interpolation: { enabled: true } }),
    'setup(names, {interpolation:{enabled:true}}) must not throw'
  );
  assert.deepEqual(plain(core.interpolation), { enabled: true, max_consecutive_missing: 1 },
    'partial interpolation option is merged with the defaults');
}
{
  const core = make();
  core.setup(DEFAULT_NAMES, { interpolation: { enabled: true, max_consecutive_missing: 3 } });
  assert.deepEqual(plain(core.interpolation), { enabled: true, max_consecutive_missing: 3 }, 'full interpolation option is kept');
  for (const key of ['acc', 'gyro', 'quat', 'converted_acc', 'converted_gyro']) {
    assert.equal(core.history_sensor_values[key].size, 3, `history_sensor_values.${key} size follows max_consecutive_missing`);
  }
}
{
  // 不正な型（null / 数値）は既定値で受ける
  const core = make();
  assert.doesNotThrow(() => core.setup(DEFAULT_NAMES, { interpolation: null }));
  assert.deepEqual(plain(core.interpolation), { enabled: false, max_consecutive_missing: 1 });
  assert.doesNotThrow(() => core.setup(DEFAULT_NAMES, null), 'setup(names, null) must not throw');
  assert.deepEqual(plain(core.interpolation), { enabled: false, max_consecutive_missing: 1 });
}
{
  // 渡したオブジェクトを SDK 側で書き換えない（呼び出し側の options を共有しない）
  const options = { interpolation: { enabled: true } };
  const core = make();
  core.setup(DEFAULT_NAMES, options);
  assert.deepEqual(options, { interpolation: { enabled: true } }, 'caller options are not mutated');
  assert.notEqual(core.interpolation, options.interpolation, 'interpolation is a fresh object');
}

console.log('core-setup-options.test.js passed');
