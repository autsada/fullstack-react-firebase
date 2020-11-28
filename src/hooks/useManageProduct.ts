import { useState } from 'react'

import { useAsyncCall } from './useAsyncCall'
import { AddProductData, UploadProduct } from '../types'
import { firebase } from '../firebase/config'
import { createImageRef, productsRef } from '../firebase'

export const useManageProduct = () => {
  const [uploadProgression, setUploadProgression] = useState(0)
  const [addProductFinished, setAddProductFinished] = useState(false)

  const { loading, setLoading, error, setError } = useAsyncCall()

  const uploadImageToStorage = (
    image: File,
    cb: (imageUrl: string, imagePath: string) => void
  ) => {
    setLoading(true)

    // 1. Upload an image to firebase storage, get back an image url
    const imageRef = createImageRef(image.name)
    const uploadTask = imageRef.put(image)

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        // Calculate upload progression
        const progression =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100

        setUploadProgression(progression)
      },
      (err) => {
        // Error case
        setError(err.message)
        setLoading(false)
      },
      () => {
        // Sucess case

        // Get the image url
        uploadTask.snapshot.ref
          .getDownloadURL()
          .then((imageUrl) => {
            cb(imageUrl, imageRef.fullPath)
          })
          .catch((err) => {
            const { message } = err as { message: string }

            setError(message)
            setLoading(false)
          })
      }
    )
  }

  const addNewProduct = (data: AddProductData, creator: string) => (
    imageUrl: string,
    imagePath: string
  ) => {
    const {
      title,
      description,
      price,
      imageFileName,
      category,
      inventory,
    } = data
    setLoading(true)
    setAddProductFinished(false)

    // 2. Create a new document in the products collection in firestore, requires product data and the image url

    const newProduct: UploadProduct = {
      title,
      description,
      price: +price,
      category,
      inventory: +inventory,
      imageUrl,
      imageFileName,
      imageRef: imagePath,
      creator,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    }

    productsRef
      .add(newProduct)
      .then(() => {
        setAddProductFinished(true)
        setLoading(false)
      })
      .catch((err) => {
        const { message } = err as { message: string }

        setError(message)
        setLoading(false)
      })
  }

  return {
    uploadImageToStorage,
    addNewProduct,
    uploadProgression,
    setUploadProgression,
    addProductFinished,
    loading,
    error,
  }
}