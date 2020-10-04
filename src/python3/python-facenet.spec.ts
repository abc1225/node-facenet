#!/usr/bin/env ts-node
import path          from 'path'

import test          from 'blue-tape'  // tslint:disable:no-shadowed-variable
import nj            from 'numjs'

import {
  MODULE_ROOT,
}                         from '../config'
import {
  imageToData,
  loadImage,
}                         from '../misc'

import { PythonFacenet }  from './python-facenet'

test('PythonFacenet python venv', async t => {
  const pf = new PythonFacenet()
  t.ok(pf, 'should be instanciated')

  const VIRTUAL_ENV = path.normalize(`${MODULE_ROOT}/python3`)
  t.equal(process.env['VIRTUAL_ENV'], VIRTUAL_ENV,              'should set VIRTUAL_ENV right')
  t.ok((process.env['PATH'] as string).startsWith(VIRTUAL_ENV), 'should set PATH right')
  t.notOk(process.env['PYTHONHOME'],                            'should have no PYTHONHOME')

  await pf.quit()
})

// test('JSON bridge', async t => {
//   const DATA1 = [[1, 2], [3, 4], [5, 6]]
//   const DATA2 = {
//     a: [[1, 2], [3, 4], [5, 6]],
//     b: 'test',
//   }
//   const DATA3 = [[[254, 0, 0], [0, 255, 1], [0, 0, 254]], [[0, 0, 0], [255, 254, 252], [127, 127, 127]]]

//   const pf = new PythonFacenet()

//   const ret1 = await pf.json_parse(JSON.stringify(DATA1))
//   t.deepEqual(ret1, DATA1, 'should be equal after processed by python bridge #1')
//   const ret2 = await pf.json_parse(JSON.stringify(DATA2))
//   t.deepEqual(ret2, DATA2, 'should be equal after processed by python bridge #2')
//   const ret3 = await pf.json_parse(JSON.stringify(DATA3))
//   t.deepEqual(ret3, DATA3, 'should be equal after processed by python bridge #3')

//   pf.quit()
// })

test('Base64 bridge', async t => {
  const IMAGE_RGB_DATA = [
    [
      [254, 0, 0],
      [0, 255, 1],
      [0, 0, 254],
    ],
    [
      [0, 0, 0],
      [255, 254, 252],
      [127, 127, 127],
    ],
  ]

  const pf = new PythonFacenet()

  try {
    const row = IMAGE_RGB_DATA.length
    const col = IMAGE_RGB_DATA[0].length
    const depth = IMAGE_RGB_DATA[0][0].length

    const flattenData = nj.array(IMAGE_RGB_DATA).flatten().tolist() as number[]

    const typedData = new Uint8Array(flattenData)
    const base64Text = Buffer.from(typedData).toString('base64')

    const ret = await pf.base64_to_image(base64Text, row, col, depth)
    t.deepEqual(ret, IMAGE_RGB_DATA, 'should be equal after processed by python base64 bridge')
  } catch (e) {
    t.fail(e)
  } finally {
    await pf.quit()
  }
})

test('align()', async t => {
  const pf = new PythonFacenet()
  const IMAGE_FILE = path.resolve(MODULE_ROOT, 'tests/fixtures/two-faces.jpg')

  try {
    await pf.initMtcnn()
    const image = await loadImage(IMAGE_FILE)
    const imageData = imageToData(image)

    const [boundingBoxes, landmarks] = await pf.align(imageData)
    const numFaces = boundingBoxes.length
    const numMarks = landmarks.length
    const confidence = boundingBoxes[0][4]

    t.equal(numFaces, 2, 'should get two faces')
    t.equal(numMarks, 10, 'should get 10 point of marks')
    t.ok(confidence > 0 && confidence < 1, 'shoud get confidencee between 0 to 1')
  } catch (e) {
    t.fail(e)
  } finally {
    await pf.quit()
  }
})

test('embedding()', async t => {
  const pf = new PythonFacenet()

  try {
    await pf.initFacenet()

    const IMAGE_FILE = path.resolve(MODULE_ROOT, 'tests/fixtures/aligned-face.png')
    const image = await loadImage(IMAGE_FILE)
    const imageData = imageToData(image)

    const embedding = await pf.embedding(imageData)

    t.equal(embedding.length, 128, 'should get 128 dim embedding')
    const valid = embedding
      .map(i => i > -0.5 && i < 0.5)
      .reduce((total, cur) => total && cur, true)
    t.ok(valid, 'should get vector normalized between -0.5 to 0.5')
  } catch (e) {
    t.fail(e)
  } finally {
    await pf.quit()
  }
})
