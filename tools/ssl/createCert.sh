#!/bin/bash

set -e

# Declare and check our dependencies
declare -a deps=("openssl")
for dep in "${deps[@]}"; do
	if ! hash ${dep} >/dev/null 2>&1; then
		echo "You must have ${dep} installed before running this script!"
		exit 1
	fi
done

CA=stackatoCA
CA_KEY=${CA}.key
CA_PEM=${CA}.pem
CA_PASS=testCAPassword123

SERVER=${1:-browser-sync}
SIGN_REQ=${SERVER}.csr
SERVER_KEY=${SERVER}.key
SERVER_CERT=${SERVER}.crt

rebuilt_ca=false

function cleanCA {
	rm -rf certsdb
	rm -f index*
	rm -f serial*
}

# Create an OpenSSL certificate authority
if [ ! -f ${CA_KEY} -o ! -f ${CA_PEM} ]; then
	echo -e "\033[31mGenerating new CA key and certificate\033[0m"
	rm -f ${CA_KEY} ${CA_PEM}

	# First create the private key
	openssl genrsa -aes256 -passout pass:${CA_PASS} -out ${CA_KEY} 2048

	# Create a self signed certificate for the CA
	sed -i "s/CN\(\s*\)=\(\s*\).*$/CN\1=\2Stackato Dev Certificate Authority/" openssl.cnf
	openssl req -x509 -new -nodes -key ${CA_KEY} -days 1024 -out ${CA_PEM} -passin pass:${CA_PASS} -config openssl.cnf
	rebuilt_ca=true
	echo -e "\033[32mYour new CA is ready to use:\n\t- cert\t${CA_PEM}\n\t- key\t${CA_KEY}\033[0m"
else
	echo -e "\033[32mYour CA already exists, not creating a new one:\n\t- cert\t${CA_PEM}\n\t- key\t${CA_KEY}\033[0m"
	echo -e "\033[32mCA key and certificate already exist\033[0m"
fi

# Create a server certificate for the Server
if [ "$rebuilt_ca" = true -o ! -f ${SERVER_KEY} -o ! -f ${SERVER_CERT} ]; then
	echo -e "\033[31mGenerating a new server certificate for ${SERVER}\033[0m"
	rm -f $SERVER_KEY $SERVER_CERT

	# First create the private key
	openssl genrsa -out ${SERVER_KEY} 2048

	# Get a certificate signing request
	sed -i "s/CN\(\s*\)=\(\s*\).*$/CN\1=\2localhost/" openssl.cnf
	openssl req -new -key ${SERVER_KEY} -out ${SIGN_REQ} -config openssl.cnf

	# Reset CA state to allow signing again
	cleanCA
	mkdir certsdb
	touch index.txt
	echo 1000 > serial

	# Finally sign the certificate using our CA
	openssl ca -cert ${CA_PEM} -keyfile ${CA_KEY} -in ${SIGN_REQ} -out ${SERVER_CERT} -config openssl.cnf -passin pass:${CA_PASS} -batch
	rm -f ${SIGN_REQ}
	cleanCA
	echo -e "\033[32mYour new certificate is ready to use:\n\t- cert\t${SERVER_CERT}\n\t- key\t${SERVER_KEY}\033[0m"
else
	echo -e "\033[32mServer certificate already exists, not creating a new one:\n\t- cert\t${SERVER_CERT}\n\t- key\t${SERVER_KEY}\033[0m"
fi

